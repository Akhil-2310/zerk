"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { usePredictionMarket } from "~~/hooks/prediction-market/usePredictionMarket";

export default function CreateMarketPage() {
  const { isConnected, chain } = useAccount();
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
    createMarketETH,
    createMarketToken,
    approveToken,
    mintAndWrapCUSDC,
    isOwner,
    isOperatorSet,
    isProcessing,
    message,
  } = usePredictionMarket({
    instance: fhevmInstance,
    initialMockChains,
  });

  const [marketType, setMarketType] = useState<"BTC_PRICE" | "ETH_PRICE">("BTC_PRICE");
  const [assetType, setAssetType] = useState<"ETH" | "CONFIDENTIAL">("ETH");
  const [strikePrice, setStrikePrice] = useState("");
  const [resolveTime, setResolveTime] = useState("");
  const [seedYes, setSeedYes] = useState("0.01");
  const [seedNo, setSeedNo] = useState("0.01");
  const [mintAmount, setMintAmount] = useState("1000");

  const handleCreate = async () => {
    if (!strikePrice || !resolveTime) return;

    const strikePriceWei = BigInt(Math.floor(parseFloat(strikePrice) * 1e8));
    const resolveTimestamp = BigInt(Math.floor(new Date(resolveTime).getTime() / 1000));
    const marketTypeEnum = marketType === "BTC_PRICE" ? 0 : 1;

    if (assetType === "ETH") {
      const seedYesWei = BigInt(Math.floor(parseFloat(seedYes) * 1e18));
      const seedNoWei = BigInt(Math.floor(parseFloat(seedNo) * 1e18));
      await createMarketETH(marketTypeEnum, strikePriceWei, resolveTimestamp, seedYesWei, seedNoWei);
    } else {
      const { CUSDC_ADDRESS } = await import("~~/hooks/prediction-market/usePredictionMarket");
      const seedYesAmount = BigInt(Math.floor(parseFloat(seedYes) * 1e6));
      const seedNoAmount = BigInt(Math.floor(parseFloat(seedNo) * 1e6));
      await createMarketToken(
        marketTypeEnum,
        CUSDC_ADDRESS,
        strikePriceWei,
        resolveTimestamp,
        seedYesAmount,
        seedNoAmount,
      );
    }
  };

  const handleMintCUSDC = async () => {
    if (!mintAmount) return;
    const amount = BigInt(Math.floor(parseFloat(mintAmount) * 1e6));
    await mintAndWrapCUSDC(amount);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">account_balance_wallet</span>
          <h2 className="text-2xl font-extrabold text-[#191C20] mb-2">Connect Your Wallet</h2>
          <p className="text-[#44474E] mb-6">Connect your wallet to create prediction markets.</p>
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 sticky top-[72px] h-[calc(100vh-72px)] bg-slate-50 border-r border-slate-100 flex-col py-8 px-6 gap-6 z-30">
        <div className="mb-4">
          <h2 className="text-[#1061FF] font-extrabold tracking-tight">Vault Terminal</h2>
          <p className="text-[10px] uppercase font-bold text-[#44474E] tracking-widest">Market Creation</p>
        </div>
        <nav className="flex flex-col gap-1">
          <Link
            href="/markets"
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 transition-all font-semibold text-sm"
          >
            <span className="material-symbols-outlined">explore</span> All Markets
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 transition-all font-semibold text-sm"
          >
            <span className="material-symbols-outlined">pie_chart</span> Portfolio
          </Link>
          <Link
            href="/create"
            className="flex items-center gap-3 px-4 py-3 bg-[#1061FF]/5 text-[#1061FF] border-r-4 border-[#1061FF] font-bold text-sm"
          >
            <span className="material-symbols-outlined">add_circle</span> New Market
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 max-w-5xl pb-24">
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Create New Market</h1>
          <p className="text-[#44474E] text-lg max-w-2xl">
            Deploy encrypted prediction markets for BTC and ETH price targets.
          </p>
        </header>

        {!isOwner && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-6 flex gap-4">
            <span className="material-symbols-outlined text-amber-600">warning</span>
            <div>
              <h4 className="text-sm font-bold text-amber-800 mb-1">Owner Only</h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                Only the contract owner can create new markets. If you believe this is an error, please check that you
                are connected with the correct wallet address.
              </p>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 bg-[#1061FF]/5 rounded-lg px-4 py-3 text-sm text-[#1061FF] font-medium">{message}</div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-7 space-y-6">
            {/* Market Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-8">
              {/* Market Type */}
              <div className="space-y-3">
                <label className="block text-sm font-bold tracking-wide uppercase text-slate-500">Market Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setMarketType("BTC_PRICE")}
                    className={`p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                      marketType === "BTC_PRICE"
                        ? "border-[#1061FF] bg-[#1061FF]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-2xl mb-2 block">₿</span>
                    <span className="font-bold text-sm">Bitcoin Price</span>
                  </button>
                  <button
                    onClick={() => setMarketType("ETH_PRICE")}
                    className={`p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                      marketType === "ETH_PRICE"
                        ? "border-[#1061FF] bg-[#1061FF]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-2xl mb-2 block">Ξ</span>
                    <span className="font-bold text-sm">Ethereum Price</span>
                  </button>
                </div>
              </div>

              {/* Asset Type */}
              <div className="space-y-3">
                <label className="block text-sm font-bold tracking-wide uppercase text-slate-500">Betting Asset</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setAssetType("ETH")}
                    className={`p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                      assetType === "ETH"
                        ? "border-[#1061FF] bg-[#1061FF]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold text-sm">ETH (Native)</span>
                    <p className="text-[10px] text-slate-500 mt-1">Bet with native Ether</p>
                  </button>
                  <button
                    onClick={() => setAssetType("CONFIDENTIAL")}
                    className={`p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                      assetType === "CONFIDENTIAL"
                        ? "border-[#1061FF] bg-[#1061FF]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold text-sm">cUSDC (Confidential)</span>
                    <p className="text-[10px] text-slate-500 mt-1">Zama Confidential USDC</p>
                  </button>
                </div>
              </div>

              {/* Strike Price */}
              <div className="space-y-3">
                <label className="block text-sm font-bold tracking-wide uppercase text-slate-500">
                  Strike Price (USD)
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg p-4 text-lg font-medium outline-none focus:border-[#1061FF] focus:ring-2 focus:ring-[#1061FF]/20 transition-all"
                  placeholder={marketType === "BTC_PRICE" ? "e.g. 150000" : "e.g. 10000"}
                  type="number"
                  value={strikePrice}
                  onChange={e => setStrikePrice(e.target.value)}
                />
              </div>

              {/* Resolve Time */}
              <div className="space-y-3">
                <label className="block text-sm font-bold tracking-wide uppercase text-slate-500">
                  Resolution Date
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg p-4 text-lg font-medium outline-none focus:border-[#1061FF] focus:ring-2 focus:ring-[#1061FF]/20 transition-all"
                  type="datetime-local"
                  value={resolveTime}
                  onChange={e => setResolveTime(e.target.value)}
                />
              </div>

              {/* Seed Liquidity */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-bold tracking-wide uppercase text-slate-500">
                    Seed YES ({assetType === "ETH" ? "ETH" : "cUSDC"})
                  </label>
                  <input
                    className="w-full border border-slate-200 rounded-lg p-4 text-lg font-medium outline-none focus:border-[#1061FF] focus:ring-2 focus:ring-[#1061FF]/20 transition-all"
                    type="number"
                    step="0.001"
                    value={seedYes}
                    onChange={e => setSeedYes(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-bold tracking-wide uppercase text-slate-500">
                    Seed NO ({assetType === "ETH" ? "ETH" : "cUSDC"})
                  </label>
                  <input
                    className="w-full border border-slate-200 rounded-lg p-4 text-lg font-medium outline-none focus:border-[#1061FF] focus:ring-2 focus:ring-[#1061FF]/20 transition-all"
                    type="number"
                    step="0.001"
                    value={seedNo}
                    onChange={e => setSeedNo(e.target.value)}
                  />
                </div>
              </div>

              {/* Operator for cUSDC */}
              {assetType === "CONFIDENTIAL" && !isOperatorSet && (
                <button
                  onClick={approveToken}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? "Setting Operator..." : "Set Operator (one-time approval)"}
                </button>
              )}

              {assetType === "CONFIDENTIAL" && isOperatorSet && (
                <p className="text-xs text-[#2E6B5D] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  Operator approved — ready to create cUSDC markets
                </p>
              )}

              {/* Submit */}
              <div className="pt-8 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleCreate}
                  disabled={
                    !strikePrice ||
                    !resolveTime ||
                    isProcessing ||
                    !isOwner ||
                    (assetType === "CONFIDENTIAL" && !isOperatorSet)
                  }
                  className="px-10 py-3 bg-[#1061FF] text-white font-extrabold rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {isProcessing ? "Creating Market..." : "Create Market"}
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Separate Mint & Wrap Card (only for cUSDC) */}
            {assetType === "CONFIDENTIAL" && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">account_balance</span>
                  <h3 className="font-extrabold">Get cUSDC Tokens</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Mint testnet USDCMock and wrap it into cUSDCMock (encrypted). Mint as much as you want — your balance
                  persists across all market creations and bets.
                </p>
                <div className="relative">
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-20 text-lg font-extrabold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    type="number"
                    step="1"
                    min="0"
                    value={mintAmount}
                    onChange={e => setMintAmount(e.target.value)}
                    placeholder="1000"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    cUSDC
                  </span>
                </div>
                <button
                  onClick={handleMintCUSDC}
                  disabled={!mintAmount || isProcessing || parseFloat(mintAmount) <= 0}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessing ? "Minting & Wrapping..." : `Mint & Wrap ${mintAmount || "0"} cUSDC`}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  3 transactions: Mint USDCMock → Approve → Wrap into cUSDCMock
                </p>
              </div>
            )}
          </div>

          {/* Preview & Info */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="px-3 py-1 bg-[#1061FF]/10 text-[#1061FF] text-[10px] font-bold uppercase rounded">
                    Preview
                  </span>
                </div>
                <h3
                  className={`text-xl font-bold leading-tight mb-4 ${strikePrice ? "text-[#191C20]" : "text-slate-300"}`}
                >
                  Will {marketType === "BTC_PRICE" ? "Bitcoin" : "Ethereum"} hit $
                  {strikePrice ? Number(strikePrice).toLocaleString() : "..."}?
                </h3>
                <div className="flex gap-2">
                  <div className="flex-1 h-12 bg-[#1061FF]/5 rounded-lg border border-[#1061FF]/10 flex items-center justify-center font-bold text-[#1061FF]">
                    YES
                  </div>
                  <div className="flex-1 h-12 bg-slate-100 rounded-lg border flex items-center justify-center font-bold text-slate-500">
                    NO
                  </div>
                </div>
                {resolveTime && (
                  <p className="text-xs text-slate-500 mt-4">
                    Resolves: {new Date(resolveTime).toLocaleDateString("en-US", { dateStyle: "long" })}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-[#1061FF]/5 p-6 rounded-xl border-l-4 border-[#1061FF] border border-slate-100 flex gap-4">
              <span className="material-symbols-outlined text-[#1061FF]">info</span>
              <div>
                <h4 className="text-sm font-bold mb-1">Creation Guidelines</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Only the contract owner can create markets. Strike prices use Chainlink oracle format (8 decimal
                  places). Seed liquidity provides the initial pool for both sides of the market.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
