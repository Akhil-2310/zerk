"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFhevm } from "@fhevm-sdk";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import {
  AssetType,
  type BattleMarketInfo,
  BattleScope,
  BattleStatus,
  MarketKind,
  useBattleMarket,
} from "~~/hooks/battle-market/useBattleMarket";
import { usePredictionMarket } from "~~/hooks/prediction-market/usePredictionMarket";

export default function BattleDetailPage() {
  const params = useParams();
  const battleId = Number(params.id);
  const { isConnected, address, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };
  const { instance: fhevmInstance } = useFhevm({ provider, chainId, initialMockChains, enabled: true });

  const battle = useBattleMarket({ instance: fhevmInstance, initialMockChains });
  // Operator approval is per-contract — for the BattleMarket we use the battle hook's
  // own approveToken / isOperatorSet. mintAndWrapCUSDC is a generic test-token helper
  // exposed by the prediction-market hook (it doesn't depend on which contract spends).
  const isOperatorSet = battle.isOperatorSet;
  const approveToken = battle.approveToken;
  const { mintAndWrapCUSDC } = usePredictionMarket({
    instance: fhevmInstance,
    initialMockChains,
  });

  const myAddr = address?.toLowerCase();
  const b = battle.battles.find(x => x.id === battleId);

  // Markets in this battle
  const battleMarkets = battle.markets.filter(m => m.battleId === battleId);

  // Permission helpers
  const isParticipant =
    !!b &&
    b.status === BattleStatus.ACTIVE &&
    (b.scope === BattleScope.ONE_V_ONE
      ? b.creator.toLowerCase() === myAddr || b.opponent.toLowerCase() === myAddr
      : battle.myGroupIds.has(b.groupId));
  // Anyone allowed to manage markets
  // 1v1: either side. Group: group admin only.
  const canManageMarkets =
    !!b &&
    b.status === BattleStatus.ACTIVE &&
    (b.scope === BattleScope.ONE_V_ONE
      ? b.creator.toLowerCase() === myAddr || b.opponent.toLowerCase() === myAddr
      : battle.groups.find(g => g.id === b.groupId)?.admin.toLowerCase() === myAddr);

  // Create-market form state
  const [showCreate, setShowCreate] = useState(false);
  const [mkKind, setMkKind] = useState<number>(MarketKind.MANUAL);
  const [mkQuestion, setMkQuestion] = useState("");
  const [mkStrike, setMkStrike] = useState("");
  const [mkDurationMinutes, setMkDurationMinutes] = useState("60");
  const [mkAsset, setMkAsset] = useState<"ETH" | "cUSDC">("ETH");
  const [mkSeed, setMkSeed] = useState("0.001"); // ETH or cUSDC

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">swords</span>
          <p className="text-[#44474E] mb-6">Connect to view this battle.</p>
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (!battle.isContractDeployed) {
    return (
      <div className="pt-16 px-8 max-w-3xl mx-auto text-center">
        <p className="text-amber-700 font-bold">Battle market contract not deployed.</p>
        <Link href="/battles" className="text-[#1061FF] underline">
          Back to battles
        </Link>
      </div>
    );
  }

  if (!b) {
    return (
      <div className="pt-16 px-8 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl font-extrabold mb-2">Battle Not Found</h1>
        <p className="text-slate-500 mb-4">No battle exists with id #{battleId}.</p>
        <Link href="/battles" className="text-[#1061FF] underline">
          Back to battles
        </Link>
      </div>
    );
  }

  const handleCreateMarket = async () => {
    const resolveTime = BigInt(Math.floor(Date.now() / 1000) + Number(mkDurationMinutes) * 60);
    const isPriceMarket = mkKind !== MarketKind.MANUAL;
    const strike = isPriceMarket ? BigInt(Math.floor(parseFloat(mkStrike || "0") * 1e8)) : 0n;
    const question = isPriceMarket ? "" : mkQuestion;

    if (mkAsset === "ETH") {
      const seedWei = BigInt(Math.floor(parseFloat(mkSeed) * 1e18));
      await battle.createMarketETH(battleId, mkKind as any, strike, question, resolveTime, seedWei, seedWei);
    } else {
      const seedMicro = BigInt(Math.floor(parseFloat(mkSeed) * 1e6));
      await battle.createMarketToken(battleId, mkKind as any, strike, question, resolveTime, seedMicro, seedMicro);
    }
    setShowCreate(false);
    setMkQuestion("");
    setMkStrike("");
  };

  const otherSide =
    b.scope === BattleScope.ONE_V_ONE ? (b.creator.toLowerCase() === myAddr ? b.opponent : b.creator) : null;

  return (
    <div className="pt-4 pb-16 px-4 md:px-8 max-w-[1200px] mx-auto">
      <Link href="/battles" className="text-xs text-[#1061FF] font-bold mb-3 inline-flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Arena
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#1061FF] mb-1">
              {b.scope === BattleScope.ONE_V_ONE ? "1v1 Battle" : "Group Battle"}
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#191C20]">Battle #{b.id}</h1>
            {b.scope === BattleScope.ONE_V_ONE && otherSide && (
              <p className="text-sm text-[#44474E] mt-2 font-mono">
                vs {otherSide.slice(0, 6)}...{otherSide.slice(-4)}
              </p>
            )}
            {b.scope === BattleScope.GROUP && (
              <Link href={`/groups/${b.groupId}`} className="text-sm text-[#1061FF] underline mt-2 inline-block">
                Group #{b.groupId} →
              </Link>
            )}
          </div>
          <BattleStatusPill status={b.status} />
        </div>
      </div>

      {battle.message && (
        <div className="mb-6 bg-[#1061FF]/5 rounded-lg px-4 py-3 text-sm text-[#1061FF] font-medium">
          {battle.message}
        </div>
      )}

      {/* Markets section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold text-[#191C20]">Markets ({battleMarkets.length})</h2>
        {canManageMarkets && (
          <button
            onClick={() => setShowCreate(s => !s)}
            className="px-4 py-2 bg-[#1061FF] text-white text-sm font-bold rounded-lg hover:bg-blue-700"
          >
            {showCreate ? "Cancel" : "+ New Market"}
          </button>
        )}
      </div>

      {/* Create-market panel */}
      {showCreate && canManageMarkets && (
        <div className="mb-6 bg-white border border-[#1061FF]/30 rounded-xl p-6 space-y-4">
          {/* Kind */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-2">
              Market Kind
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: MarketKind.MANUAL, l: "Manual" },
                { v: MarketKind.BTC_PRICE, l: "BTC Price" },
                { v: MarketKind.ETH_PRICE, l: "ETH Price" },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setMkKind(opt.v)}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    mkKind === opt.v
                      ? "bg-[#1061FF]/10 border-[#1061FF] text-[#1061FF]"
                      : "bg-slate-50 border-slate-200 text-[#44474E]"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {mkKind === MarketKind.MANUAL ? (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Question
              </label>
              <input
                placeholder="Will Alice ship her hackathon project on time?"
                value={mkQuestion}
                onChange={e => setMkQuestion(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1061FF]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Strike Price (USD)
              </label>
              <input
                type="number"
                step="any"
                placeholder="100000"
                value={mkStrike}
                onChange={e => setMkStrike(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1061FF]"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Resolves YES if {mkKind === MarketKind.BTC_PRICE ? "BTC" : "ETH"} &gt; this price at resolve time
                (Chainlink).
              </p>
            </div>
          )}

          {/* Asset + seed + duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Collateral
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(["ETH", "cUSDC"] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => setMkAsset(a)}
                    className={`py-2 text-xs font-bold rounded-lg border ${
                      mkAsset === a
                        ? "bg-[#1061FF]/10 border-[#1061FF] text-[#1061FF]"
                        : "bg-slate-50 border-slate-200 text-[#44474E]"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Seed (each side)
              </label>
              <input
                type="number"
                step="any"
                value={mkSeed}
                onChange={e => setMkSeed(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1061FF]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Duration (min)
              </label>
              <input
                type="number"
                min="1"
                value={mkDurationMinutes}
                onChange={e => setMkDurationMinutes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1061FF]"
              />
            </div>
          </div>

          {mkAsset === "cUSDC" && !isOperatorSet && (
            <button
              onClick={approveToken}
              disabled={battle.isProcessing}
              className="w-full py-2.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
            >
              Set cUSDC Operator (one-time approval)
            </button>
          )}

          <button
            onClick={handleCreateMarket}
            disabled={
              battle.isProcessing ||
              (mkKind === MarketKind.MANUAL ? !mkQuestion : !mkStrike) ||
              !mkSeed ||
              (mkAsset === "cUSDC" && !isOperatorSet)
            }
            className="w-full py-3 rounded-lg bg-[#1061FF] text-white font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {battle.isProcessing ? "Creating..." : "Create Market"}
          </button>

          {mkAsset === "cUSDC" && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">Need cUSDC? Mint testnet tokens</summary>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => mintAndWrapCUSDC(BigInt(100 * 1e6))}
                  disabled={battle.isProcessing}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  Mint 100 cUSDC
                </button>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Markets list */}
      {battleMarkets.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-3 block">target</span>
          <p className="font-bold text-[#191C20]">No markets yet</p>
          {canManageMarkets && <p className="text-sm text-slate-400 mt-1">Create the first market for this battle.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {battleMarkets.map(m => (
            <BattleMarketCard
              key={m.id}
              market={m}
              isParticipant={isParticipant}
              canManageMarkets={canManageMarkets}
              hook={battle}
              isOperatorSet={isOperatorSet}
              onApproveOperator={approveToken}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BattleStatusPill({ status }: { status: number }) {
  const cfg =
    status === BattleStatus.PENDING
      ? { l: "Pending Acceptance", c: "bg-amber-50 text-amber-700 border-amber-200" }
      : status === BattleStatus.ACTIVE
        ? { l: "Active", c: "bg-green-50 text-green-700 border-green-200" }
        : { l: "Cancelled", c: "bg-slate-50 text-slate-500 border-slate-200" };
  return (
    <span className={`px-3 py-1.5 text-[11px] font-extrabold rounded-full uppercase border ${cfg.c}`}>{cfg.l}</span>
  );
}

function BattleMarketCard({
  market,
  isParticipant,
  canManageMarkets,
  hook,
  isOperatorSet,
  onApproveOperator,
}: {
  market: BattleMarketInfo;
  isParticipant: boolean;
  canManageMarkets: boolean;
  hook: ReturnType<typeof useBattleMarket>;
  isOperatorSet: boolean;
  onApproveOperator: () => Promise<void>;
}) {
  const bet = hook.betStatuses[market.id];
  const nowSec = Math.floor(Date.now() / 1000);
  const pastResolve = nowSec >= market.resolveTimestamp;
  const isToken = market.assetType === AssetType.CONFIDENTIAL;

  const [side, setSide] = useState<boolean | null>(null);
  const [amount, setAmount] = useState(isToken ? "10" : "0.005");

  const revealedSide = hook.revealedData[`${market.id}-side`];
  const revealedAmount = hook.revealedData[`${market.id}-amount`];

  const placeBet = async () => {
    if (side === null) return;
    if (isToken) {
      await hook.placeBetToken(market.id, side, BigInt(Math.floor(parseFloat(amount) * 1e6)));
    } else {
      await hook.placeBetETH(market.id, side, BigInt(Math.floor(parseFloat(amount) * 1e18)));
    }
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-extrabold rounded uppercase">
              {market.kind === MarketKind.MANUAL
                ? "Manual"
                : market.kind === MarketKind.BTC_PRICE
                  ? "BTC Oracle"
                  : "ETH Oracle"}
            </span>
            <span className="px-2 py-0.5 bg-[#1061FF]/10 text-[#1061FF] text-[9px] font-extrabold rounded uppercase">
              {isToken ? "cUSDC" : "ETH"}
            </span>
            <MarketStatusPill market={market} pastResolve={pastResolve} />
          </div>
          <p className="font-extrabold text-[#191C20]">{market.title}</p>
          <p className="text-xs text-slate-400 mt-1">Resolves {market.resolveTime}</p>
          {market.resolved && (
            <p className={`text-sm font-bold mt-2 ${market.outcome ? "text-[#2E6B5D]" : "text-[#BA1A1A]"}`}>
              Outcome: {market.outcome ? "YES" : "NO"}
            </p>
          )}
        </div>
      </div>

      {/* User's bet (if any) */}
      {bet?.hasBet && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat
            label="Your Side"
            value={
              revealedSide !== undefined ? (
                <span className={revealedSide ? "text-[#1061FF]" : "text-[#BA1A1A]"}>
                  {revealedSide ? "YES" : "NO"}
                </span>
              ) : (
                <Locked />
              )
            }
          />
          <Stat
            label="Amount"
            value={
              isToken ? (
                revealedAmount !== undefined ? (
                  <>{(Number(revealedAmount) / 1e6).toFixed(2)} cUSDC</>
                ) : (
                  <Locked />
                )
              ) : (
                <>{Number(ethers.formatEther(bet.ethAmount)).toFixed(4)} ETH</>
              )
            }
          />
          <Stat
            label="Status"
            value={
              bet.claimed ? (
                <span className="text-[#2E6B5D]">Claimed</span>
              ) : market.totalsReady ? (
                <span className="text-amber-600">Claimable</span>
              ) : market.resolved ? (
                <span className="text-blue-600">Decrypting</span>
              ) : (
                <span className="text-[#1061FF]">Active</span>
              )
            }
          />
          {revealedSide === undefined && !bet.claimed && (
            <button
              onClick={() => hook.revealBet(market.id)}
              disabled={hook.isProcessing}
              className="col-span-3 mt-1 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-xs align-middle mr-1">visibility</span>
              Reveal My Bet
            </button>
          )}
        </div>
      )}

      {/* Action area */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Place bet (participant, market live) */}
        {isParticipant && !bet?.hasBet && !market.resolved && !pastResolve && (
          <div className="w-full bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide(true)}
                className={`py-2 text-xs font-bold rounded-lg border-2 transition-all cursor-pointer ${
                  side === true
                    ? "border-[#1061FF] bg-[#1061FF]/5 text-[#1061FF]"
                    : "border-transparent bg-white text-[#44474E]"
                }`}
              >
                YES
              </button>
              <button
                onClick={() => setSide(false)}
                className={`py-2 text-xs font-bold rounded-lg border-2 transition-all cursor-pointer ${
                  side === false
                    ? "border-[#BA1A1A] bg-[#BA1A1A]/5 text-[#BA1A1A]"
                    : "border-transparent bg-white text-[#44474E]"
                }`}
              >
                NO
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1061FF]"
              />
              {isToken && !isOperatorSet ? (
                <button
                  onClick={onApproveOperator}
                  disabled={hook.isProcessing}
                  className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  Approve cUSDC
                </button>
              ) : (
                <button
                  onClick={placeBet}
                  disabled={hook.isProcessing || side === null || !amount}
                  className="px-4 py-2 bg-[#1061FF] text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Place Bet
                </button>
              )}
            </div>
          </div>
        )}

        {/* Resolve (price market, anyone after resolveTime) */}
        {!market.resolved && pastResolve && market.kind !== MarketKind.MANUAL && (
          <button
            onClick={() => hook.resolvePriceMarket(market.id)}
            disabled={hook.isProcessing}
            className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            Resolve via Oracle
          </button>
        )}

        {/* Resolve (manual market, only allowed managers, after resolveTime) */}
        {!market.resolved && pastResolve && market.kind === MarketKind.MANUAL && canManageMarkets && (
          <>
            <button
              onClick={() => hook.resolveManualMarket(market.id, true)}
              disabled={hook.isProcessing}
              className="px-3 py-2 bg-[#2E6B5D] text-white text-xs font-bold rounded-lg hover:bg-[#245a4e] disabled:opacity-50"
            >
              Resolve YES
            </button>
            <button
              onClick={() => hook.resolveManualMarket(market.id, false)}
              disabled={hook.isProcessing}
              className="px-3 py-2 bg-[#BA1A1A] text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Resolve NO
            </button>
          </>
        )}

        {/* Decrypt totals */}
        {market.resolved && !market.totalsReady && (
          <button
            onClick={() => hook.submitTotals(market.id)}
            disabled={hook.isProcessing}
            className="px-4 py-2 bg-[#1061FF] text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Decrypt Totals
          </button>
        )}

        {/* Claim */}
        {market.totalsReady &&
          bet?.hasBet &&
          !bet.claimed &&
          (isToken ? (
            <button
              onClick={() => hook.claimToken(market.id)}
              disabled={hook.isProcessing}
              className="px-4 py-2 bg-[#2E6B5D] text-white text-xs font-bold rounded-lg hover:bg-[#245a4e] disabled:opacity-50"
            >
              Claim cUSDC
            </button>
          ) : (
            <button
              onClick={() => hook.prepareAndClaimETH(market.id)}
              disabled={hook.isProcessing}
              className="px-4 py-2 bg-[#2E6B5D] text-white text-xs font-bold rounded-lg hover:bg-[#245a4e] disabled:opacity-50"
            >
              Decrypt &amp; Claim ETH
            </button>
          ))}
      </div>
    </div>
  );
}

function MarketStatusPill({ market, pastResolve }: { market: BattleMarketInfo; pastResolve: boolean }) {
  let label = "Active";
  let cls = "bg-green-50 text-green-700 border-green-200";
  if (market.totalsReady) {
    label = "Settled";
    cls = "bg-slate-50 text-slate-600 border-slate-200";
  } else if (market.resolved) {
    label = "Decrypting";
    cls = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (pastResolve) {
    label = "Awaiting Resolution";
    cls = "bg-amber-50 text-amber-700 border-amber-200";
  }
  return <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase border ${cls}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-0.5">{label}</p>
      <p className="text-sm font-extrabold text-[#191C20]">{value}</p>
    </div>
  );
}

function Locked() {
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
      <span className="material-symbols-outlined text-xs">lock</span>
      Encrypted
    </span>
  );
}
