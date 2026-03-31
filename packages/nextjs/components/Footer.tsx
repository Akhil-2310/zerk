"use client";

import React from "react";
import Link from "next/link";

export const Footer = () => (
  <footer className="bg-white py-16 border-t border-slate-100">
    <div className="flex flex-col md:flex-row justify-between items-start px-8 max-w-[1440px] mx-auto gap-12">
      <div className="max-w-xs">
        <span className="font-bold text-slate-400 text-2xl mb-4 block tracking-tighter">Zerk</span>
        <p className="text-slate-500 text-sm leading-relaxed">
          The institutional bridge for high-fidelity encrypted prediction markets. Empowering data-driven decision
          making with FHE confidentiality.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-12 md:gap-24">
        <div className="flex flex-col gap-4">
          <span className="text-slate-900 font-bold text-sm">Platform</span>
          <Link className="text-slate-500 hover:text-[#1061FF] transition-colors text-xs tracking-wide" href="/markets">
            Markets
          </Link>
          <Link
            className="text-slate-500 hover:text-[#1061FF] transition-colors text-xs tracking-wide"
            href="/dashboard"
          >
            Dashboard
          </Link>
          <Link className="text-slate-500 hover:text-[#1061FF] transition-colors text-xs tracking-wide" href="/create">
            Create Market
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          <span className="text-slate-900 font-bold text-sm">Technology</span>
          <a
            className="text-slate-500 hover:text-[#1061FF] transition-colors text-xs tracking-wide"
            href="https://docs.zama.ai/protocol"
            target="_blank"
            rel="noopener noreferrer"
          >
            Zama Protocol
          </a>
          <a
            className="text-slate-500 hover:text-[#1061FF] transition-colors text-xs tracking-wide"
            href="https://docs.zama.ai/protocol/zama-protocol-litepaper"
            target="_blank"
            rel="noopener noreferrer"
          >
            FHE Docs
          </a>
        </div>
        <div className="flex flex-col gap-4">
          <span className="text-slate-900 font-bold text-sm">Legal</span>
          <span className="text-slate-500 text-xs tracking-wide">Terms of Service</span>
          <span className="text-slate-500 text-xs tracking-wide">Privacy Policy</span>
          <span className="text-slate-500 text-xs tracking-wide">Risk Disclosure</span>
        </div>
      </div>
    </div>
    <div className="max-w-[1440px] mx-auto px-8 mt-16 pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
      <p className="text-slate-400 text-xs tracking-wide">Zerk Encrypted Prediction Markets. Powered by Zama FHE.</p>
    </div>
  </footer>
);
