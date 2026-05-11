import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { ethers } from "ethers";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const CONTRACT_ADDRESS = "0xa5992143C81fbAd3Bbe55060B1473e587E633a01";

const CHAINLINK_BTC_USD = "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43";
const CHAINLINK_ETH_USD = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const CUSDC_ADDRESS = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";

const MARKET_DURATION_SECONDS = 30 * 60;
const SEED_WEI = ethers.parseEther("0.001");
const STRIKE_OFFSET_BPS = 100; // 1%

const ASSET_CONFIDENTIAL = 1;

const AGGREGATOR_ABI = ["function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"];
const CUSDC_ABI = ["function isOperator(address holder, address spender) view returns (bool)"];

const PREDICTION_MARKET_ABI = [
  "function marketCount() view returns (uint256)",
  "function markets(uint256) view returns (uint8 assetType, uint8 marketType, address token, uint256 strikePrice, uint256 resolveTime, bool resolved, bool outcome, bytes32 totalYes, bytes32 totalNo, uint64 totalPoolPlain, uint64 winningPoolPlain, bool totalsReady)",
  "function owner() view returns (address)",
  "function createMarketETH(uint8 marketType, uint256 strikePrice, uint256 resolveTime, uint256 seedYes, uint256 seedNo) payable",
  "function createMarketToken(uint8 marketType, address token, uint256 strikePrice, uint256 resolveTime, bytes32 seedYes, bytes32 seedNo, bytes proof)",
  "function resolveMarket(uint256 id)",
  "function getTotalHandles(uint256 id) view returns (bytes32 yesHandle, bytes32 noHandle)",
  "function submitTotals(uint256 id, bytes abiEncodedCleartexts, bytes decryptionProof)",
];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

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
  if (cronSecret && headerSecret === cronSecret) return true;
  if (!qstashReady && !cronSecret) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundPrice(price: number, direction: "up" | "down", offsetBps: number): bigint {
  const factor = direction === "up" ? 1 + offsetBps / 10000 : 1 - offsetBps / 10000;
  const target = price * factor;

  let step: number;
  if (price > 50000) step = 500;
  else if (price > 10000) step = 100;
  else if (price > 1000) step = 50;
  else step = 10;

  const rounded = direction === "up" ? Math.ceil(target / step) * step : Math.floor(target / step) * step;
  return BigInt(Math.round(rounded * 1e8));
}

type ParsedKey = { ok: true; key: string } | { ok: false; hexDigitCount: number; nonHex: boolean };

function parseOwnerPrivateKey(raw: string | undefined): ParsedKey {
  if (!raw?.trim()) return { ok: false, hexDigitCount: 0, nonHex: false };
  let s = raw.trim().replace(/\s+/g, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).replace(/\s+/g, "");
  }
  const hex = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
  const nonHex = hex.length > 0 && !/^[0-9a-fA-F]+$/.test(hex);
  if (nonHex || hex.length !== 64) return { ok: false, hexDigitCount: hex.length, nonHex };
  return { ok: true, key: `0x${hex.toLowerCase()}` };
}

function parseCusdcSeedMicro(): bigint {
  try {
    const n = BigInt((process.env.CRON_CUSDC_SEED_MICRO || "10000").replace(/\s+/g, "") || "10000");
    return n > 0n ? n : 10000n;
  } catch {
    return 10000n;
  }
}

function toHexBytes(u8: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(u8).toString("hex")}` as `0x${string}`;
}

type FhevmInst = Awaited<ReturnType<typeof getFhevmInstance>>;
async function getFhevmInstance() {
  const { createInstance, SepoliaConfigV2 } = await import("@zama-fhe/relayer-sdk/node");
  return createInstance({ ...SepoliaConfigV2, network: SEPOLIA_RPC });
}

interface MarketSnapshot {
  id: number;
  assetType: number;
  marketType: number;
  strikePrice: bigint;
  resolveTime: number;
  resolved: boolean;
  totalsReady: boolean;
}

interface ActionLog {
  resolved: string[];
  decrypted: string[];
  created: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const isValid = await verifyCronRequest(req);
  if (!isValid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawKey = process.env.CRON_OWNER_PRIVATE_KEY;
  const parsed = parseOwnerPrivateKey(rawKey);
  if (!parsed.ok) {
    const hint = rawKey?.trim()
      ? parsed.nonHex
        ? "CRON_OWNER_PRIVATE_KEY has non-hex chars."
        : `Key has ${parsed.hexDigitCount} hex digits; need 64.`
      : "CRON_OWNER_PRIVATE_KEY not set.";
    return NextResponse.json({ error: hint, hexDigitCount: parsed.hexDigitCount }, { status: 500 });
  }

  const log: ActionLog = { resolved: [], decrypted: [], created: [], errors: [] };

  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(parsed.key, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, wallet);

    const onChainOwner = await contract.owner();
    if (onChainOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      return NextResponse.json({ error: "Wallet is not the contract owner" }, { status: 403 });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const marketCount = Number(await contract.marketCount());

    // ---- Batch-read all markets in parallel ----
    const snapshots: MarketSnapshot[] = [];
    const BATCH = 10;
    for (let start = 0; start < marketCount; start += BATCH) {
      const end = Math.min(start + BATCH, marketCount);
      const batch = await Promise.allSettled(
        Array.from({ length: end - start }, (_, j) => contract.markets(start + j)),
      );
      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        if (r.status === "fulfilled") {
          const m = r.value;
          snapshots.push({
            id: start + j,
            assetType: Number(m.assetType),
            marketType: Number(m.marketType),
            strikePrice: BigInt(m.strikePrice),
            resolveTime: Number(m.resolveTime),
            resolved: m.resolved,
            totalsReady: m.totalsReady,
          });
        }
      }
    }

    // ---- Phase 1: Resolve expired markets ----
    for (const s of snapshots) {
      if (!s.resolved && nowSec >= s.resolveTime) {
        try {
          const tx = await contract.resolveMarket(s.id);
          await tx.wait();
          s.resolved = true;
          log.resolved.push(`Market #${s.id} resolved (tx: ${tx.hash})`);
        } catch (e) {
          log.errors.push(`Resolve #${s.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    // ---- Phase 2: Decrypt totals (resolved && !totalsReady) ----
    const needDecrypt = snapshots.filter(s => s.resolved && !s.totalsReady);
    if (needDecrypt.length > 0) {
      let fhevm: FhevmInst | undefined;
      try {
        fhevm = await getFhevmInstance();
      } catch (e) {
        log.errors.push(`FHEVM init: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (fhevm) {
        for (const s of needDecrypt) {
          try {
            const { yesHandle, noHandle } = await contract.getTotalHandles(s.id);
            const result = await fhevm.publicDecrypt([yesHandle, noHandle]);
            const tx = await contract.submitTotals(s.id, result.abiEncodedClearValues, result.decryptionProof);
            await tx.wait();
            s.totalsReady = true;
            log.decrypted.push(`Market #${s.id} decrypted (tx: ${tx.hash})`);
          } catch (e) {
            log.errors.push(`Decrypt #${s.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }

    // ---- Phase 3: Determine which new markets to create ----
    const btcFeed = new ethers.Contract(CHAINLINK_BTC_USD, AGGREGATOR_ABI, provider);
    const ethFeed = new ethers.Contract(CHAINLINK_ETH_USD, AGGREGATOR_ABI, provider);
    const [[, btcAnswer], [, ethAnswer]] = await Promise.all([btcFeed.latestRoundData(), ethFeed.latestRoundData()]);

    const btcPrice = Number(btcAnswer) / 1e8;
    const ethPrice = Number(ethAnswer) / 1e8;

    const strikes = {
      btcUp: roundPrice(btcPrice, "up", STRIKE_OFFSET_BPS),
      btcDown: roundPrice(btcPrice, "down", STRIKE_OFFSET_BPS),
      ethUp: roundPrice(ethPrice, "up", STRIKE_OFFSET_BPS),
      ethDown: roundPrice(ethPrice, "down", STRIKE_OFFSET_BPS),
    };

    type Slots = { btcUp: boolean; btcDown: boolean; ethUp: boolean; ethDown: boolean };
    const openEth: Slots = { btcUp: false, btcDown: false, ethUp: false, ethDown: false };
    const openCusdc: Slots = { btcUp: false, btcDown: false, ethUp: false, ethDown: false };
    const tol = BigInt(1e8);

    for (const s of snapshots) {
      if (s.resolved || s.resolveTime <= nowSec) continue;
      const bucket = s.assetType === ASSET_CONFIDENTIAL ? openCusdc : openEth;
      const sp = s.strikePrice;
      if (s.marketType === 0) {
        if (sp >= strikes.btcUp - tol && sp <= strikes.btcUp + tol) bucket.btcUp = true;
        if (sp >= strikes.btcDown - tol && sp <= strikes.btcDown + tol) bucket.btcDown = true;
      } else {
        if (sp >= strikes.ethUp - tol && sp <= strikes.ethUp + tol) bucket.ethUp = true;
        if (sp >= strikes.ethDown - tol && sp <= strikes.ethDown + tol) bucket.ethDown = true;
      }
    }

    const pct = `${STRIKE_OFFSET_BPS / 100}%`;
    type MktSpec = { type: number; strike: bigint; label: string };

    const toCreate = (slots: Slots): MktSpec[] => {
      const list: MktSpec[] = [];
      if (!slots.btcUp) list.push({ type: 0, strike: strikes.btcUp, label: `BTC +${pct} ($${(Number(strikes.btcUp) / 1e8).toLocaleString()})` });
      if (!slots.btcDown) list.push({ type: 0, strike: strikes.btcDown, label: `BTC -${pct} ($${(Number(strikes.btcDown) / 1e8).toLocaleString()})` });
      if (!slots.ethUp) list.push({ type: 1, strike: strikes.ethUp, label: `ETH +${pct} ($${(Number(strikes.ethUp) / 1e8).toLocaleString()})` });
      if (!slots.ethDown) list.push({ type: 1, strike: strikes.ethDown, label: `ETH -${pct} ($${(Number(strikes.ethDown) / 1e8).toLocaleString()})` });
      return list;
    };

    const ethMkts = toCreate(openEth);
    const cusdcMkts = toCreate(openCusdc);

    // ---- Phase 4a: Create ETH markets ----
    const resolveTime = BigInt(nowSec + MARKET_DURATION_SECONDS);
    for (const mkt of ethMkts) {
      try {
        const tx = await contract.createMarketETH(mkt.type, mkt.strike, resolveTime, SEED_WEI, SEED_WEI, {
          value: SEED_WEI * 2n,
        });
        await tx.wait();
        log.created.push(`[ETH] ${mkt.label} (tx: ${tx.hash})`);
      } catch (e) {
        log.errors.push(`Create [ETH] ${mkt.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ---- Phase 4b: Create cUSDC markets ----
    if (cusdcMkts.length > 0) {
      const cusdc = new ethers.Contract(CUSDC_ADDRESS, CUSDC_ABI, provider);
      const isOp = await cusdc.isOperator(wallet.address, CONTRACT_ADDRESS);
      if (!isOp) {
        log.errors.push("cUSDC skipped: owner hasn't set prediction market as cUSDC operator.");
      } else {
        let fhevm: FhevmInst | undefined;
        if (needDecrypt.length > 0) {
          // already initialized above — but it went out of scope; re-init
        }
        try {
          fhevm = await getFhevmInstance();
        } catch (e) {
          log.errors.push(`FHEVM init (create): ${e instanceof Error ? e.message : String(e)}`);
        }
        if (fhevm) {
          const seedMicro = parseCusdcSeedMicro();
          for (const mkt of cusdcMkts) {
            try {
              const input = fhevm.createEncryptedInput(CONTRACT_ADDRESS, wallet.address);
              input.add64(seedMicro);
              input.add64(seedMicro);
              const { handles, inputProof } = await input.encrypt();
              const tx = await contract.createMarketToken(
                mkt.type, CUSDC_ADDRESS, mkt.strike, resolveTime,
                toHexBytes(handles[0]!), toHexBytes(handles[1]!), toHexBytes(inputProof),
              );
              await tx.wait();
              log.created.push(`[cUSDC] ${mkt.label} (tx: ${tx.hash})`);
            } catch (e) {
              log.errors.push(`Create [cUSDC] ${mkt.label}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      prices: { btc: btcPrice, eth: ethPrice },
      marketCount,
      ...log,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
