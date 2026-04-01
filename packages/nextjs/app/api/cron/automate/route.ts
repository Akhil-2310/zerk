import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { ethers } from "ethers";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CONTRACT_ADDRESS = "0xa5992143C81fbAd3Bbe55060B1473e587E633a01";

const CHAINLINK_BTC_USD = "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43";
const CHAINLINK_ETH_USD = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const MARKET_DURATION_SECONDS = 30 * 60; // 30 minutes
const SEED_WEI = ethers.parseEther("0.001"); // 0.001 ETH per side
const STRIKE_OFFSET_BPS = 500; // 5% = 500 basis points

const AGGREGATOR_ABI = ["function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"];

const PREDICTION_MARKET_ABI = [
  "function marketCount() view returns (uint256)",
  "function markets(uint256) view returns (uint8 assetType, uint8 marketType, address token, uint256 strikePrice, uint256 resolveTime, bool resolved, bool outcome, bytes32 totalYes, bytes32 totalNo, uint64 totalPoolPlain, uint64 winningPoolPlain, bool totalsReady)",
  "function owner() view returns (address)",
  "function createMarketETH(uint8 marketType, uint256 strikePrice, uint256 resolveTime, uint256 seedYes, uint256 seedNo) payable",
  "function resolveMarket(uint256 id)",
];

/**
 * Auth: (1) Upstash-Signature when QStash signing keys are set; or (2) x-cron-secret === CRON_SECRET.
 * Browser GET has neither → 401 when anything is configured (expected).
 */
async function verifyCronRequest(req: NextRequest): Promise<boolean> {
  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");
  const signature = req.headers.get("upstash-signature") || "";
  const qstashReady = Boolean(signingKey && nextSigningKey);

  if (qstashReady && signature) {
    try {
      const receiver = new Receiver({ currentSigningKey: signingKey!, nextSigningKey: nextSigningKey! });
      const body = await req.text();
      await receiver.verify({ signature, body, url: req.url });
      return true;
    } catch {
      return false;
    }
  }

  if (cronSecret && headerSecret === cronSecret) {
    return true;
  }

  // No QStash keys and no CRON_SECRET → open (local dev only; set secrets in production)
  if (!qstashReady && !cronSecret) {
    return true;
  }

  return false;
}

function roundPrice(price: number, direction: "up" | "down", offsetBps: number): bigint {
  const factor = direction === "up" ? 1 + offsetBps / 10000 : 1 - offsetBps / 10000;
  const target = price * factor;

  let step: number;
  if (price > 50000) step = 5000;
  else if (price > 10000) step = 1000;
  else if (price > 1000) step = 100;
  else step = 50;

  const rounded = direction === "up" ? Math.ceil(target / step) * step : Math.floor(target / step) * step;

  return BigInt(Math.round(rounded * 1e8));
}

interface ActionLog {
  resolved: string[];
  created: string[];
  errors: string[];
}

type ParsedKey = { ok: true; key: string } | { ok: false; hexDigitCount: number; nonHex: boolean };

/** Sepolia owner key: exactly 32 bytes as hex (64 chars), optional 0x. Strips all whitespace (Vercel/multiline pastes). */
function parseOwnerPrivateKey(raw: string | undefined): ParsedKey {
  if (!raw?.trim()) {
    return { ok: false, hexDigitCount: 0, nonHex: false };
  }
  let s = raw.trim().replace(/\s+/g, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).replace(/\s+/g, "");
  }
  const hex = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
  const nonHex = hex.length > 0 && !/^[0-9a-fA-F]+$/.test(hex);
  if (nonHex || hex.length !== 64) {
    return { ok: false, hexDigitCount: hex.length, nonHex };
  }
  return { ok: true, key: `0x${hex.toLowerCase()}` };
}

export async function POST(req: NextRequest) {
  const isValid = await verifyCronRequest(req);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawKey = process.env.CRON_OWNER_PRIVATE_KEY;
  const parsed = parseOwnerPrivateKey(rawKey);
  if (!parsed.ok) {
    const hint =
      rawKey && rawKey.trim()
        ? parsed.nonHex
          ? "CRON_OWNER_PRIVATE_KEY contains non-hex characters. Paste only 0–9 and a–f (64 digits, optional 0x)."
          : `After trimming whitespace, the key has ${parsed.hexDigitCount} hex digits; need exactly 64 (32 bytes). Re-copy the owner private key in Vercel — with or without 0x is fine.`
        : "Set CRON_OWNER_PRIVATE_KEY to the contract owner’s private key (same format as Hardhat DEPLOYER_PRIVATE_KEY).";
    return NextResponse.json(
      { error: "Invalid or missing CRON_OWNER_PRIVATE_KEY", detail: hint, hexDigitCount: parsed.hexDigitCount },
      { status: 500 },
    );
  }
  const privateKey = parsed.key;

  const log: ActionLog = { resolved: [], created: [], errors: [] };

  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, wallet);

    const onChainOwner = await contract.owner();
    if (onChainOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      return NextResponse.json({ error: "Wallet is not the contract owner" }, { status: 403 });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const marketCount = Number(await contract.marketCount());

    // --- Phase 1: Resolve expired markets ---
    for (let i = 0; i < marketCount; i++) {
      try {
        const m = await contract.markets(i);
        const resolveTime = Number(m.resolveTime);
        if (!m.resolved && nowSec >= resolveTime) {
          const tx = await contract.resolveMarket(i);
          await tx.wait();
          log.resolved.push(`Market #${i} resolved (tx: ${tx.hash})`);
        }
      } catch (e) {
        log.errors.push(`Resolve market #${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // --- Phase 2: Check if we need new markets ---
    const hasActiveBTC = { up: false, down: false };
    const hasActiveETH = { up: false, down: false };

    const btcFeed = new ethers.Contract(CHAINLINK_BTC_USD, AGGREGATOR_ABI, provider);
    const ethFeed = new ethers.Contract(CHAINLINK_ETH_USD, AGGREGATOR_ABI, provider);

    const [, btcAnswer] = await btcFeed.latestRoundData();
    const [, ethAnswer] = await ethFeed.latestRoundData();

    const btcPrice = Number(btcAnswer) / 1e8;
    const ethPrice = Number(ethAnswer) / 1e8;

    const btcStrikeUp = roundPrice(btcPrice, "up", STRIKE_OFFSET_BPS);
    const btcStrikeDown = roundPrice(btcPrice, "down", STRIKE_OFFSET_BPS);
    const ethStrikeUp = roundPrice(ethPrice, "up", STRIKE_OFFSET_BPS);
    const ethStrikeDown = roundPrice(ethPrice, "down", STRIKE_OFFSET_BPS);

    for (let i = 0; i < marketCount; i++) {
      try {
        const m = await contract.markets(i);
        if (m.resolved || Number(m.resolveTime) <= nowSec) continue;

        const strike = BigInt(m.strikePrice);
        if (Number(m.marketType) === 0) {
          if (strike >= btcStrikeUp - BigInt(1e8) && strike <= btcStrikeUp + BigInt(1e8)) hasActiveBTC.up = true;
          if (strike >= btcStrikeDown - BigInt(1e8) && strike <= btcStrikeDown + BigInt(1e8)) hasActiveBTC.down = true;
        } else {
          if (strike >= ethStrikeUp - BigInt(1e8) && strike <= ethStrikeUp + BigInt(1e8)) hasActiveETH.up = true;
          if (strike >= ethStrikeDown - BigInt(1e8) && strike <= ethStrikeDown + BigInt(1e8)) hasActiveETH.down = true;
        }
      } catch {
        // ignore
      }
    }

    // --- Phase 3: Create new markets ---
    const resolveTime = BigInt(nowSec + MARKET_DURATION_SECONDS);
    const totalSeed = SEED_WEI * 2n;

    const marketsToCreate: { type: number; strike: bigint; label: string }[] = [];

    if (!hasActiveBTC.up)
      marketsToCreate.push({
        type: 0,
        strike: btcStrikeUp,
        label: `BTC +5% ($${(Number(btcStrikeUp) / 1e8).toLocaleString()})`,
      });
    if (!hasActiveBTC.down)
      marketsToCreate.push({
        type: 0,
        strike: btcStrikeDown,
        label: `BTC -5% ($${(Number(btcStrikeDown) / 1e8).toLocaleString()})`,
      });
    if (!hasActiveETH.up)
      marketsToCreate.push({
        type: 1,
        strike: ethStrikeUp,
        label: `ETH +5% ($${(Number(ethStrikeUp) / 1e8).toLocaleString()})`,
      });
    if (!hasActiveETH.down)
      marketsToCreate.push({
        type: 1,
        strike: ethStrikeDown,
        label: `ETH -5% ($${(Number(ethStrikeDown) / 1e8).toLocaleString()})`,
      });

    for (const mkt of marketsToCreate) {
      try {
        const tx = await contract.createMarketETH(mkt.type, mkt.strike, resolveTime, SEED_WEI, SEED_WEI, {
          value: totalSeed,
        });
        await tx.wait();
        log.created.push(`${mkt.label} (tx: ${tx.hash})`);
      } catch (e) {
        log.errors.push(`Create ${mkt.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      prices: { btc: btcPrice, eth: ethPrice },
      ...log,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
