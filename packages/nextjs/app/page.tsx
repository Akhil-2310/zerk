"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-8 py-24 md:py-40 bg-[#FDFBFF]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 text-left">
            <h1 className="text-5xl md:text-7xl font-extrabold text-[#191C20] leading-tight tracking-tight mb-8">
              Encrypted <span className="text-[#1061FF]">Prediction</span> Markets.
            </h1>
            <p className="text-lg md:text-xl text-[#44474E] max-w-xl mb-12 leading-relaxed">
              Place encrypted bets on BTC and ETH price movements. Your choice and amount stay confidential with Zama
              FHE — nobody knows what you bet or how much.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => router.push("/markets")}
                className="signature-gradient text-white px-8 py-4 rounded-md font-bold text-lg hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                Explore Markets
              </button>
              <a
                href="https://docs.zama.ai/protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#EDEDF4] text-[#191C20] px-8 py-4 rounded-md font-bold text-lg hover:bg-[#E7E8EE] transition-all"
              >
                How FHE Works
              </a>
            </div>
          </div>
          <div className="flex-1 w-full max-w-2xl relative">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#1061FF]/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#2E6B5D]/10 rounded-full blur-3xl"></div>
            <div className="relative bg-white rounded-xl p-8 shadow-xl ring-1 ring-black/5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#44474E]">Live Markets</span>
                  <span className="px-2.5 py-1 bg-[#B3F0DF] text-[#2E6B5D] text-[10px] font-bold rounded flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#2E6B5D] rounded-full animate-pulse"></span> Active
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">₿</div>
                    <span className="font-bold text-[#191C20]">Will BTC hit $150k?</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 text-center py-2 bg-[#1061FF]/5 rounded border border-[#1061FF]/10 text-[#1061FF] font-bold text-sm">
                      YES 64%
                    </div>
                    <div className="flex-1 text-center py-2 bg-slate-50 rounded border border-slate-200 text-slate-600 font-bold text-sm">
                      NO 36%
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">Ξ</div>
                    <span className="font-bold text-[#191C20]">Will ETH hit $10k?</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 text-center py-2 bg-[#1061FF]/5 rounded border border-[#1061FF]/10 text-[#1061FF] font-bold text-sm">
                      YES 42%
                    </div>
                    <div className="flex-1 text-center py-2 bg-slate-50 rounded border border-slate-200 text-slate-600 font-bold text-sm">
                      NO 58%
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Bets encrypted with Zama FHE
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#F3F3FA] py-24 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-10 rounded-xl hover:translate-y-[-4px] transition-transform duration-300">
            <div className="w-14 h-14 rounded-full bg-[#DBE2F9] flex items-center justify-center mb-8">
              <span className="material-symbols-outlined text-[#1061FF] text-3xl">encrypted</span>
            </div>
            <h3 className="text-2xl font-bold mb-4 text-[#191C20]">Encrypted Bets</h3>
            <p className="text-[#44474E] leading-relaxed">
              Your Yes/No choice and bet amount are encrypted using Fully Homomorphic Encryption. Nobody can see your
              position.
            </p>
          </div>
          <div className="bg-white p-10 rounded-xl hover:translate-y-[-4px] transition-transform duration-300">
            <div className="w-14 h-14 rounded-full bg-[#B3F0DF] flex items-center justify-center mb-8">
              <span className="material-symbols-outlined text-[#2E6B5D] text-3xl">currency_bitcoin</span>
            </div>
            <h3 className="text-2xl font-bold mb-4 text-[#191C20]">BTC & ETH Markets</h3>
            <p className="text-[#44474E] leading-relaxed">
              Predict whether BTC or ETH will reach target prices. Markets resolved using Chainlink price feeds.
            </p>
          </div>
          <div className="bg-white p-10 rounded-xl hover:translate-y-[-4px] transition-transform duration-300">
            <div className="w-14 h-14 rounded-full bg-[#D6E2FF] flex items-center justify-center mb-8">
              <span className="material-symbols-outlined text-[#1061FF] text-3xl">payments</span>
            </div>
            <h3 className="text-2xl font-bold mb-4 text-[#191C20]">ETH & cUSDC</h3>
            <p className="text-[#44474E] leading-relaxed">
              Bet with native ETH or Zama&apos;s Confidential USDC token for fully private on-chain prediction markets.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-8">
        <div className="max-w-5xl mx-auto signature-gradient rounded-3xl p-16 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">
              Ready to bet with privacy?
            </h2>
            <p className="text-white/80 text-lg mb-12 max-w-2xl mx-auto">
              Connect your wallet to start placing encrypted predictions on crypto price markets.
            </p>
            <button
              onClick={() => router.push("/markets")}
              className="bg-white text-[#1061FF] px-10 py-5 rounded-md font-bold text-xl hover:bg-[#FDFBFF] transition-all active:scale-95 shadow-lg cursor-pointer"
            >
              Start Predicting
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
