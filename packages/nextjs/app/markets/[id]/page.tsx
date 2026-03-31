"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useFhevm } from "@fhevm-sdk";
import { usePredictionMarket } from "~~/hooks/prediction-market/usePredictionMarket";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { ethers } from "ethers";

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = Number(params.id);
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
    markets,
    betStatuses,
    revealedData,
    isOwner,
    isOperatorSet,
    placeBetETH,
    placeBetToken,
    approveToken,
    mintAndWrapCUSDC,
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

  const [selectedSide, setSelectedSide] = useState<boolean | null>(null);
  const [betAmount, setBetAmount] = useState<string>("0.01");
  const [mintAmount, setMintAmount] = useState<string>("100");

  const market = markets.find(m => m.id === marketId);
  const bet = betStatuses[marketId];

  const defaultMarkets: Record<
    number,
    {
      title: string;
      marketType: string;
      strikePrice: string;
      resolveTime: string;
      resolveTimestamp: number;
      assetType: string;
      icon: string;
      iconBg: string;
    }
  > = {
    0: {
      title: "Will Bitcoin reach $150,000?",
      marketType: "BTC_PRICE",
      strikePrice: "150000",
      resolveTime: "Dec 31, 2026",
      resolveTimestamp: 0,
      assetType: "ETH",
      icon: "₿",
      iconBg: "bg-orange-100",
    },
    1: {
      title: "Will Ethereum reach $10,000?",
      marketType: "ETH_PRICE",
      strikePrice: "10000",
      resolveTime: "Dec 31, 2026",
      resolveTimestamp: 0,
      assetType: "ETH",
      icon: "Ξ",
      iconBg: "bg-blue-100",
    },
  };

  const display = market || defaultMarkets[marketId] || defaultMarkets[0];
  const nowSec = Math.floor(Date.now() / 1000);
  const isPastResolveTime = market ? nowSec >= market.resolveTimestamp : false;
  const isTokenMarket = display?.assetType !== "ETH";

  const revealedSide = revealedData[`${marketId}-side`];
  const revealedAmount = revealedData[`${marketId}-amount`];

  const handleMintCUSDC = async () => {
    if (!mintAmount) return;
    const amount = BigInt(Math.floor(parseFloat(mintAmount) * 1e6));
    await mintAndWrapCUSDC(amount);
  };

  const handlePlaceBet = async () => {
    if (selectedSide === null || !betAmount) return;

    if (display?.assetType === "ETH") {
      const amountWei = BigInt(Math.floor(parseFloat(betAmount) * 1e18));
      await placeBetETH(marketId, selectedSide, amountWei);
    } else {
      await placeBetToken(marketId, selectedSide, BigInt(Math.floor(parseFloat(betAmount) * 1e6)));
    }
  };

  if (!display) {
    return (
      <div className="pt-8 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">Market Not Found</h1>
        <p className="text-slate-500">This market does not exist yet.</p>
      </div>
    );
  }

  return (
    <div className="pt-4 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Market Info */}
      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#44474E]">
          <span>Crypto</span>
          <span className="w-1 h-1 bg-[#C4C6D0] rounded-full"></span>
          <span>{display.marketType === "BTC_PRICE" ? "Bitcoin" : "Ethereum"}</span>
          <span className="ml-auto px-2.5 py-1 rounded flex items-center gap-1.5">
            {market?.resolved ? (
              <span className="bg-[#2E6B5D]/10 text-[#2E6B5D] px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs">check_circle</span> Resolved
              </span>
            ) : isPastResolveTime ? (
              <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs">schedule</span> Awaiting Resolution
              </span>
            ) : (
              <span className="bg-[#B3F0DF] text-[#2E6B5D] px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#2E6B5D] rounded-full animate-pulse"></span> Live Market
              </span>
            )}
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#191C20]">{display.title}</h1>

        {/* Market Details Card */}
        <div className="bg-white border border-slate-200/30 rounded-xl p-8 space-y-6 shadow-sm">
          <div className="border-b border-slate-200/30 flex gap-8">
            <button className="pb-4 text-[#1061FF] font-bold border-b-2 border-[#1061FF]">About</button>
            <button className="pb-4 text-[#44474E] font-bold hover:text-[#191C20] transition-colors">Rules</button>
          </div>
          <p className="text-[#44474E] font-medium leading-relaxed">
            This market will resolve to &ldquo;Yes&rdquo; if{" "}
            {display.marketType === "BTC_PRICE" ? "Bitcoin (BTC)" : "Ethereum (ETH)"} reaches a price of $
            {Number(display.strikePrice).toLocaleString()} or higher by the resolution date. Price is determined by
            Chainlink oracle price feeds.
          </p>

          {market?.resolved && (
            <div
              className={`p-4 rounded-xl border-l-4 ${market.outcome ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">
                  {market.outcome ? "trending_up" : "trending_down"}
                </span>
                <span className="font-extrabold text-lg">Outcome: {market.outcome ? "YES" : "NO"}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                {market.outcome
                  ? `Price exceeded $${Number(display.strikePrice).toLocaleString()} at resolution time.`
                  : `Price did not reach $${Number(display.strikePrice).toLocaleString()} at resolution time.`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
            {[
              { label: "Strike Price", value: `$${Number(display.strikePrice).toLocaleString()}` },
              { label: "Asset", value: display.marketType === "BTC_PRICE" ? "Bitcoin" : "Ethereum" },
              { label: "End Date", value: display.resolveTime },
              { label: "Bet With", value: display.assetType === "ETH" ? "ETH" : "cUSDC" },
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="text-[10px] text-[#44474E] font-bold uppercase tracking-wider">{item.label}</div>
                <div className="text-lg font-extrabold text-[#191C20]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Your Bet Status (if user has a bet) */}
        {bet?.hasBet && (
          <div className="bg-white border border-slate-200/30 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1061FF]">receipt_long</span>
                <h3 className="font-extrabold text-lg">Your Bet</h3>
              </div>
              {!bet.claimed && (
                <button
                  onClick={() => revealBet(marketId)}
                  disabled={isProcessing || revealedSide !== undefined}
                  className="px-4 py-2 bg-[#1061FF]/10 text-[#1061FF] text-xs font-bold rounded-lg hover:bg-[#1061FF]/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {revealedSide !== undefined ? "Revealed" : isProcessing ? "Decrypting..." : "Reveal My Bet"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">Your Side</p>
                {revealedSide !== undefined ? (
                  <p className={`text-lg font-extrabold ${revealedSide ? "text-[#1061FF]" : "text-[#BA1A1A]"}`}>
                    {revealedSide ? "YES" : "NO"}
                  </p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">lock</span>
                    <span className="text-sm text-slate-400 font-medium">Encrypted</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">Amount</p>
                {display.assetType === "ETH" ? (
                  <p className="text-lg font-extrabold text-[#191C20]">
                    {Number(ethers.formatEther(bet.ethAmount)).toFixed(4)} ETH
                  </p>
                ) : revealedAmount !== undefined ? (
                  <p className="text-lg font-extrabold text-[#191C20]">
                    {(Number(revealedAmount) / 1e6).toFixed(2)} cUSDC
                  </p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">lock</span>
                    <span className="text-sm text-slate-400 font-medium">Encrypted</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">Status</p>
                <p className="text-lg font-extrabold">
                  {bet.claimed ? (
                    <span className="text-[#2E6B5D]">Claimed</span>
                  ) : market?.totalsReady ? (
                    <span className="text-amber-600">Ready to Claim</span>
                  ) : (
                    <span className="text-[#1061FF]">Active</span>
                  )}
                </p>
              </div>
            </div>

            {revealedSide === undefined && (
              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">info</span>
                Click &ldquo;Reveal My Bet&rdquo; to decrypt your encrypted side
                {isTokenMarket ? " and amount" : ""}. This requires a wallet signature.
              </p>
            )}
          </div>
        )}

        {/* Encryption Info */}
        <div className="bg-[#1061FF]/5 p-6 rounded-xl border-l-4 border-[#1061FF] border border-slate-100 flex gap-4">
          <span className="material-symbols-outlined text-[#1061FF]">encrypted</span>
          <div>
            <h4 className="text-sm font-bold mb-1">Fully Encrypted Market</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              All bets in this market are encrypted using Zama&apos;s Fully Homomorphic Encryption (FHE). Your Yes/No
              choice and bet amount remain completely private on-chain. The smart contract computes over encrypted data
              without ever revealing individual positions.
            </p>
          </div>
        </div>

        {/* Owner Admin Panel */}
        {isOwner && market && (
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <h3 className="font-extrabold text-lg">Owner Controls</h3>
            </div>

            {message && <div className="bg-white/10 rounded-lg px-4 py-2 text-sm font-medium">{message}</div>}

            <div className="flex flex-wrap gap-3">
              {!market.resolved && isPastResolveTime && (
                <button
                  onClick={() => resolveMarket(marketId)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">gavel</span>
                  {isProcessing ? "Resolving..." : "1. Resolve Market"}
                </button>
              )}
              {!market.resolved && !isPastResolveTime && (
                <div className="flex items-center gap-2 px-5 py-3 bg-white/10 rounded-lg text-sm">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  Market resolves {display.resolveTime}
                </div>
              )}

              {market.resolved && !market.totalsReady && (
                <button
                  onClick={() => submitTotals(marketId)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-3 bg-[#1061FF] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">key</span>
                  {isProcessing ? "Decrypting..." : "2. Decrypt Totals"}
                </button>
              )}

              {market.resolved && market.totalsReady && (
                <div className="flex items-center gap-2 px-5 py-3 bg-green-500/20 text-green-300 rounded-lg text-sm font-bold">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Market fully resolved — claims enabled
                </div>
              )}
            </div>

            <p className="text-xs text-white/50">
              Flow: Resolve Market → Decrypt Totals (via Zama Relayer) → Users can claim
            </p>
          </div>
        )}
      </div>

      {/* Trading / Claim Panel */}
      <div className="lg:col-span-4 space-y-6">
        <div className="sticky top-24 space-y-5">
          {/* Claim UI if market fully resolved */}
          {market?.totalsReady ? (
            <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/40 p-6 space-y-4">
              <h2 className="text-xl font-extrabold">Claim Winnings</h2>
              <div
                className={`p-4 rounded-xl ${market.outcome ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
              >
                <p className="font-bold text-sm">Market Outcome: {market.outcome ? "YES" : "NO"}</p>
              </div>

              {message && (
                <div className="bg-[#1061FF]/5 rounded-lg px-4 py-2 text-xs text-[#1061FF] font-medium">{message}</div>
              )}

              {!bet?.hasBet ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">block</span>
                  <p className="text-sm text-slate-500 font-medium">You didn&apos;t place a bet on this market.</p>
                </div>
              ) : bet.claimed ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-3xl text-green-400 mb-2 block">task_alt</span>
                  <p className="text-sm text-[#2E6B5D] font-bold">Already claimed!</p>
                </div>
              ) : market.assetType === "ETH" ? (
                <>
                  <button
                    onClick={() => prepareAndClaimETH(marketId)}
                    disabled={isProcessing || !isConnected}
                    className="w-full py-4 rounded-xl bg-[#2E6B5D] text-white font-extrabold text-lg hover:bg-[#245a4e] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? "Processing Claim..." : "Decrypt & Claim ETH"}
                  </button>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <span className="font-bold">How it works:</span> Your win/loss status is encrypted on-chain. This
                      button computes your result, sends it to the KMS for decryption (~30s), then submits the proof.
                      You&apos;ll receive your ETH payout if you predicted correctly.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => claimToken(marketId)}
                    disabled={isProcessing || !isConnected}
                    className="w-full py-4 rounded-xl bg-[#2E6B5D] text-white font-extrabold text-lg hover:bg-[#245a4e] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? "Processing Claim..." : "Claim cUSDC"}
                  </button>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800 leading-relaxed">
                      <span className="font-bold">How it works:</span> Your payout is computed entirely in encrypted
                      form. If you predicted correctly, you&apos;ll receive your proportional share as encrypted cUSDC.
                      If you predicted incorrectly, the encrypted payout will be zero.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Bet Form */}
              <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/40 p-6">
                <h2 className="text-xl font-extrabold mb-6">Place Encrypted Bet</h2>

                {!isConnected ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-4 block">
                      account_balance_wallet
                    </span>
                    <p className="text-slate-500 mb-4">Connect wallet to place bets</p>
                    <RainbowKitCustomConnectButton />
                  </div>
                ) : market?.resolved ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-amber-300 mb-4 block">hourglass_top</span>
                    <p className="text-slate-500">Market resolved. Awaiting total decryption by owner.</p>
                  </div>
                ) : bet?.hasBet ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-[#1061FF] mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <p className="font-bold text-[#191C20] mb-1">Bet Already Placed</p>
                    <p className="text-sm text-slate-500">
                      You already have an active bet on this market. One bet per wallet per market.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Side Selection */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSelectedSide(true)}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          selectedSide === true
                            ? "border-[#1061FF] bg-[#1061FF]/5"
                            : "border-transparent bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                            selectedSide === true ? "text-[#1061FF]" : "text-[#44474E]"
                          }`}
                        >
                          Yes
                        </span>
                        <span className="material-symbols-outlined text-[#1061FF]">thumb_up</span>
                      </button>
                      <button
                        onClick={() => setSelectedSide(false)}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          selectedSide === false
                            ? "border-[#BA1A1A] bg-[#BA1A1A]/5"
                            : "border-transparent bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                            selectedSide === false ? "text-[#BA1A1A]" : "text-[#44474E]"
                          }`}
                        >
                          No
                        </span>
                        <span className="material-symbols-outlined text-[#BA1A1A]">thumb_down</span>
                      </button>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-2 ml-1">
                        Bet Amount ({isTokenMarket ? "cUSDC" : "ETH"})
                      </label>
                      <div className="relative">
                        <input
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-4 pr-16 text-xl font-extrabold outline-none focus:border-[#1061FF] focus:ring-2 focus:ring-[#1061FF]/20 transition-all"
                          type="number"
                          step={isTokenMarket ? "1" : "0.001"}
                          min="0"
                          value={betAmount}
                          onChange={e => setBetAmount(e.target.value)}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          {isTokenMarket ? "cUSDC" : "ETH"}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#44474E]">Your Side</span>
                        <span className="font-bold">
                          {selectedSide === null ? "—" : selectedSide ? "YES" : "NO"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#44474E]">Encryption</span>
                        <span className="text-[#2E6B5D] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">lock</span> FHE Encrypted
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-500">Both side & amount are encrypted on-chain</span>
                      </div>
                    </div>

                    {message && (
                      <div className="bg-[#1061FF]/5 rounded-lg px-4 py-2 text-xs text-[#1061FF] font-medium">
                        {message}
                      </div>
                    )}

                    {/* cUSDC operator setup */}
                    {isTokenMarket && !isOperatorSet && (
                      <button
                        onClick={approveToken}
                        disabled={isProcessing}
                        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessing ? "Setting Operator..." : "Set Operator (one-time approval)"}
                      </button>
                    )}

                    {/* Place Bet */}
                    <button
                      onClick={handlePlaceBet}
                      disabled={
                        selectedSide === null ||
                        !betAmount ||
                        isProcessing ||
                        parseFloat(betAmount) <= 0 ||
                        (isTokenMarket && !isOperatorSet)
                      }
                      className="w-full py-4 rounded-xl bg-[#1061FF] text-white font-extrabold text-lg shadow-lg shadow-[#1061FF]/20 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isProcessing ? "Encrypting & Placing Bet..." : "Place Encrypted Bet"}
                    </button>

                    {isTokenMarket && isOperatorSet && (
                      <p className="text-xs text-[#2E6B5D] font-medium flex items-center gap-1 justify-center">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        Operator approved — you can place cUSDC bets
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Separate Mint & Wrap Card (only for cUSDC markets) */}
              {isTokenMarket && isConnected && !market?.resolved && (
                <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/40 p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-emerald-600">account_balance</span>
                    <h3 className="font-extrabold">Get cUSDC Tokens</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Mint testnet USDCMock and wrap it into cUSDCMock (encrypted). Mint as much as you want — you can
                    then place multiple bets across different markets.
                  </p>
                  <div className="relative">
                    <input
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-20 text-lg font-extrabold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      type="number"
                      step="1"
                      min="0"
                      value={mintAmount}
                      onChange={e => setMintAmount(e.target.value)}
                      placeholder="100"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
