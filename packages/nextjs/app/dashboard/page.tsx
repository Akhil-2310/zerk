"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFhevm } from "@fhevm-sdk";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { usePredictionMarket } from "~~/hooks/prediction-market/usePredictionMarket";

export default function DashboardPage() {
  const { isConnected, address, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const {
    markets,
    betStatuses,
    revealedData,
    isOwner,
    resolveMarket,
    submitTotals,
    prepareAndClaimETH,
    claimToken,
    revealBet,
    isProcessing,
    message,
  } = usePredictionMarket({
    instance: fhevmInstance,
    initialMockChains,
  });

  type TabFilter = "positions" | "all";
  const [tab, setTab] = useState<TabFilter>("positions");

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">account_balance_wallet</span>
          <h2 className="text-2xl font-extrabold text-[#191C20] mb-2">Connect Your Wallet</h2>
          <p className="text-[#44474E] mb-6">Connect your wallet to view your encrypted positions and portfolio.</p>
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const marketsWithBets = markets.filter(m => betStatuses[m.id]?.hasBet);

  return (
    <div className="flex min-h-[calc(100vh-72px)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 sticky top-[72px] h-[calc(100vh-72px)] bg-white border-r border-slate-100 flex-col py-8 px-6 gap-6 z-30">
        <div className="mb-4">
          <h2 className="text-[#1061FF] font-extrabold tracking-tight">Vault Terminal</h2>
          <p className="text-[10px] uppercase font-bold text-[#44474E] tracking-widest">Portfolio</p>
        </div>
        <nav className="flex flex-col gap-1">
          <Link
            href="/markets"
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#1061FF] transition-all font-semibold text-sm"
          >
            <span className="material-symbols-outlined">explore</span> All Markets
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 bg-[#1061FF]/5 text-[#1061FF] border-r-4 border-[#1061FF] font-bold text-sm"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              pie_chart
            </span>{" "}
            Portfolio
          </Link>
          <Link
            href="/create"
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#1061FF] transition-all font-semibold text-sm"
          >
            <span className="material-symbols-outlined">add_circle</span> New Market
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 max-w-6xl pb-24">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2 bg-white border border-slate-100 rounded-xl p-8 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[#44474E] font-bold text-[11px] uppercase tracking-widest mb-2">Wallet Address</p>
              <div className="flex items-baseline gap-4">
                <h1 className="text-lg font-extrabold text-[#191C20] tracking-tight font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </h1>
                {isOwner && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded uppercase">
                    Owner
                  </span>
                )}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-[#44474E] font-bold text-[11px] uppercase tracking-widest mb-2">Your Bets</p>
                <span className="text-3xl font-extrabold text-[#191C20]">{marketsWithBets.length}</span>
              </div>
              <div>
                <p className="text-[#44474E] font-bold text-[11px] uppercase tracking-widest mb-2">Total Markets</p>
                <span className="text-3xl font-extrabold text-slate-400">{markets.length}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <p className="text-[#44474E] font-bold text-[11px] uppercase tracking-widest mb-1">Encryption</p>
              <span className="text-sm font-bold text-[#2E6B5D] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lock</span> All positions encrypted
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
              <p className="text-[#44474E] font-bold text-[11px] uppercase tracking-widest mb-1">Network</p>
              <span className="text-sm font-extrabold">{chain?.name || "Not connected"}</span>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-6 bg-[#1061FF]/5 rounded-lg px-4 py-3 text-sm text-[#1061FF] font-medium">{message}</div>
        )}

        {/* Owner Admin Section */}
        {isOwner && markets.some(m => !m.totalsReady) && (
          <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <h3 className="font-extrabold text-lg">Owner: Market Resolution</h3>
            </div>
            <div className="space-y-3">
              {markets
                .filter(m => !m.totalsReady)
                .map(m => {
                  const pastResolve = nowSec >= m.resolveTimestamp;
                  return (
                    <div key={m.id} className="flex items-center justify-between bg-white/10 rounded-lg p-4">
                      <div>
                        <p className="font-bold text-sm">{m.title}</p>
                        <p className="text-xs text-white/60">
                          {m.resolved
                            ? "Resolved — needs total decryption"
                            : pastResolve
                              ? "Past end date — needs resolution"
                              : `Resolves ${m.resolveTime}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!m.resolved && pastResolve && (
                          <button
                            onClick={() => resolveMarket(m.id)}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
                          >
                            Resolve
                          </button>
                        )}
                        {m.resolved && !m.totalsReady && (
                          <button
                            onClick={() => submitTotals(m.id)}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-[#1061FF] text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                          >
                            Decrypt Totals
                          </button>
                        )}
                        {!m.resolved && !pastResolve && (
                          <span className="text-xs text-white/40 px-4 py-2">Waiting...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-8">
          <button
            onClick={() => setTab("positions")}
            className={`px-5 py-2 text-sm font-bold rounded-md transition-all cursor-pointer ${
              tab === "positions" ? "bg-white text-[#191C20] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Your Positions ({marketsWithBets.length})
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-5 py-2 text-sm font-bold rounded-md transition-all cursor-pointer ${
              tab === "all" ? "bg-white text-[#191C20] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            All Markets ({markets.length})
          </button>
        </div>

        {/* Your Positions */}
        {tab === "positions" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm mb-10">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[#44474E] text-[11px] font-extrabold uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Market</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Your Side</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {marketsWithBets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
                      No bets yet. Place a bet on a market to get started.
                    </td>
                  </tr>
                ) : (
                  marketsWithBets.map(m => {
                    const bet = betStatuses[m.id];
                    const sideKey = `${m.id}-side`;
                    const amtKey = `${m.id}-amount`;
                    const revSide = revealedData[sideKey];
                    const revAmt = revealedData[amtKey];

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${m.iconBg}`}>
                              {m.icon}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{m.title}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                Strike: ${Number(m.strikePrice).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="px-2.5 py-1 bg-[#1061FF]/10 text-[#1061FF] text-[10px] font-extrabold rounded-full uppercase border border-[#1061FF]/20">
                            {m.assetType === "ETH" ? "ETH" : "cUSDC"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          {revSide !== undefined ? (
                            <span className={`font-extrabold text-sm ${revSide ? "text-[#1061FF]" : "text-[#BA1A1A]"}`}>
                              {revSide ? "YES" : "NO"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                              <span className="material-symbols-outlined text-xs">lock</span>
                              Encrypted
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {m.assetType === "ETH" ? (
                            <span className="font-bold text-sm">
                              {Number(ethers.formatEther(bet?.ethAmount || 0n)).toFixed(4)} ETH
                            </span>
                          ) : revAmt !== undefined ? (
                            <span className="font-bold text-sm">{(Number(revAmt) / 1e6).toFixed(2)} cUSDC</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                              <span className="material-symbols-outlined text-xs">lock</span>
                              Encrypted
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full uppercase ${
                              bet?.claimed
                                ? "bg-slate-100 text-slate-500 border border-slate-200"
                                : m.totalsReady
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : m.resolved
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {bet?.claimed
                              ? "Claimed"
                              : m.totalsReady
                                ? "Claimable"
                                : m.resolved
                                  ? "Decrypting"
                                  : "Active"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!bet?.claimed && revSide === undefined && (
                              <button
                                onClick={() => revealBet(m.id)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Decrypt your side and amount"
                              >
                                <span className="material-symbols-outlined text-xs align-middle mr-0.5">
                                  visibility
                                </span>
                                Reveal
                              </button>
                            )}

                            {m.totalsReady && !bet?.claimed ? (
                              m.assetType === "ETH" ? (
                                <button
                                  onClick={() => prepareAndClaimETH(m.id)}
                                  disabled={isProcessing}
                                  className="px-4 py-2 bg-[#2E6B5D] text-white text-xs font-bold rounded-lg hover:bg-[#245a4e] transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {isProcessing ? "Claiming..." : "Claim ETH"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => claimToken(m.id)}
                                  disabled={isProcessing}
                                  className="px-4 py-2 bg-[#2E6B5D] text-white text-xs font-bold rounded-lg hover:bg-[#245a4e] transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {isProcessing ? "Claiming..." : "Claim cUSDC"}
                                </button>
                              )
                            ) : (
                              <Link
                                href={`/markets/${m.id}`}
                                className="px-4 py-2 bg-[#1061FF]/10 text-[#1061FF] text-xs font-bold rounded-lg hover:bg-[#1061FF]/20 transition-colors"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* All Markets (without bets) */}
        {tab === "all" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[#44474E] text-[11px] font-extrabold uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Market</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Bet</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {markets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No markets yet.
                    </td>
                  </tr>
                ) : (
                  markets.map(m => {
                    const hasBet = betStatuses[m.id]?.hasBet;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${m.iconBg}`}>
                              {m.icon}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{m.title}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                Strike: ${Number(m.strikePrice).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="px-2.5 py-1 bg-[#1061FF]/10 text-[#1061FF] text-[10px] font-extrabold rounded-full uppercase border border-[#1061FF]/20">
                            {m.assetType === "ETH" ? "ETH" : "cUSDC"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          {hasBet ? (
                            <span className="px-2 py-0.5 bg-[#1061FF]/10 text-[#1061FF] text-[10px] font-bold rounded">
                              Active
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full uppercase ${
                              m.totalsReady
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : m.resolved
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : nowSec >= m.resolveTimestamp
                                    ? "bg-red-50 text-red-600 border border-red-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {m.totalsReady
                              ? "Resolved"
                              : m.resolved
                                ? "Decrypting"
                                : nowSec >= m.resolveTimestamp
                                  ? "Closed"
                                  : "Active"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Link
                            href={`/markets/${m.id}`}
                            className="px-4 py-2 bg-[#1061FF]/10 text-[#1061FF] text-xs font-bold rounded-lg hover:bg-[#1061FF]/20 transition-colors"
                          >
                            {hasBet ? "View" : m.totalsReady || nowSec >= m.resolveTimestamp ? "View" : "Place Bet"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
