"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RainbowKitCustomConnectButton } from "~~/components/helper";

export const Header = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: "/markets", label: "Markets" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/create", label: "Create" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-100">
      <div className="flex items-center justify-between px-8 py-4 max-w-[1440px] mx-auto w-full">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-[#1061FF]">
            Vault
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-semibold transition-colors duration-200 ${
                  pathname === link.href
                    ? "text-[#1061FF] border-b-2 border-[#1061FF]"
                    : "text-slate-600 hover:text-[#1061FF]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    </nav>
  );
};
