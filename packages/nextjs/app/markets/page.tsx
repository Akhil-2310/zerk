"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePredictionMarket } from "~~/hooks/prediction-market/usePredictionMarket";

type AssetFilter = "all" | "BTC" | "ETH";
type StatusFilter = "all" | "open" | "closed";

export default function MarketsPage() {
  const router = useRouter();
  const { markets, isLoading } = usePredictionMarket();

  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const nowSec = Math.floor(Date.now() / 1000);

  const filteredMarkets = useMemo(() => {
    let list = markets.length > 0 ? markets : [];

    if (assetFilter === "BTC") list = list.filter(m => m.marketType === "BTC_PRICE");
    else if (assetFilter === "ETH") list = list.filter(m => m.marketType === "ETH_PRICE");

    if (statusFilter === "open") list = list.filter(m => !m.resolved && nowSec < m.resolveTimestamp);
    else if (statusFilter === "closed") list = list.filter(m => m.resolved || nowSec >= m.resolveTimestamp);

    return list;
  }, [markets, assetFilter, statusFilter, nowSec]);

  const assetButtons: { key: AssetFilter; label: string }[] = [
    { key: "all", label: "All Markets" },
    { key: "BTC", label: "Bitcoin" },
    { key: "ETH", label: "Ethereum" },
  ];

  const statusButtons: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <div className="pb-12 px-8 max-w-[1440px] mx-auto">
      <header className="mb-10 pt-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Encrypted Prediction Markets</h1>
        <p className="text-slate-600 max-w-2xl text-lg mb-8">
          Place confidential bets on BTC and ETH price movements. Your position and amount stay encrypted with Zama FHE.
        </p>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Asset filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {assetButtons.map(b => (
              <button
                key={b.key}
                onClick={() => setAssetFilter(b.key)}
                className={`px-5 py-2 rounded-md text-sm font-bold transition-all cursor-pointer ${assetFilter === b.key ? "bg-white text-[#191C20] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {statusButtons.map(b => (
              <button
                key={b.key}
                onClick={() => setStatusFilter(b.key)}
                className={`px-5 py-2 rounded-md text-sm font-bold transition-all cursor-pointer ${statusFilter === b.key ? "bg-white text-[#191C20] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Count */}
          <span className="text-sm text-slate-400 font-medium">
            {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1061FF]"></div>
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-4">search_off</span>
          <p className="font-bold text-lg mb-1">No markets found</p>
          <p className="text-sm">Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredMarkets.map((m, i) => {
            const isClosed = m.resolved || nowSec >= m.resolveTimestamp;
            return (
              <div
                key={i}
                onClick={() => router.push(`/markets/${m.id}`)}
                className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[#1061FF]/30 hover:shadow-xl transition-all cursor-pointer flex flex-col"
              >
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-full ${m.iconBg || "bg-slate-100"} flex items-center justify-center text-xl font-bold`}
                    >
                      {m.icon || "?"}
                    </div>
                    <div>
                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1.5 w-fit ${isClosed ? "bg-slate-100 text-slate-500" : "bg-[#B3F0DF] text-[#2E6B5D]"}`}
                      >
                        {!isClosed && <span className="w-1.5 h-1.5 bg-[#2E6B5D] rounded-full animate-pulse"></span>}
                        {m.totalsReady ? "Resolved" : m.resolved ? "Resolving" : isClosed ? "Closed" : "Live Market"}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-[#1061FF] transition-colors leading-tight">
                    {m.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Strike: ${Number(m.strikePrice).toLocaleString()} &bull;{" "}
                    {m.marketType === "BTC_PRICE" ? "Bitcoin" : "Ethereum"} &bull;{" "}
                    {m.assetType === "ETH" ? "Bet with ETH" : "Bet with cUSDC"}
                  </p>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Encrypted Pool</span>
                    <span className="text-xs font-bold text-[#1061FF] flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">lock</span> Hidden until resolution
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full mb-6 flex overflow-hidden">
                    <div className="h-full bg-[#1061FF]/20 w-full animate-pulse"></div>
                  </div>
                  {!isClosed ? (
                    <div className="grid grid-cols-2 gap-3 mt-auto">
                      <button className="py-3 rounded-lg bg-[#1061FF]/5 text-[#1061FF] border border-[#1061FF]/10 font-bold cursor-pointer hover:bg-[#1061FF]/10 transition-colors">
                        YES
                      </button>
                      <button className="py-3 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 font-bold cursor-pointer hover:bg-slate-100 transition-colors">
                        NO
                      </button>
                    </div>
                  ) : (
                    <div className="mt-auto py-3 text-center text-sm font-bold text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                      {m.totalsReady ? "Market Resolved" : "Awaiting Resolution"}
                    </div>
                  )}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Ends: {m.resolveTime}</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">encrypted</span> FHE Encrypted
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      <div className="mt-12 max-w-md mx-auto">
        <div className="bg-[#1061FF]/5 p-6 rounded-xl border-l-4 border-[#1061FF] border border-slate-100 flex gap-4">
          <span className="material-symbols-outlined text-[#1061FF]">info</span>
          <div>
            <h4 className="text-sm font-bold mb-1">How Encrypted Markets Work</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              When you place a bet, your Yes/No choice and amount are encrypted using Zama&apos;s FHE. The smart
              contract processes bets without ever decrypting individual positions. Only after market resolution are
              aggregated totals revealed for payout calculation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
