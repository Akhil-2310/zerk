"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { BattleScope, BattleStatus, JoinMode, useBattleMarket } from "~~/hooks/battle-market/useBattleMarket";

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = Number(params.id);
  const { isConnected, address, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };
  const { instance: fhevmInstance } = useFhevm({ provider, chainId, initialMockChains, enabled: true });

  const hook = useBattleMarket({ instance: fhevmInstance, initialMockChains });

  const myAddr = address?.toLowerCase();
  const group = hook.groups.find(g => g.id === groupId);
  const isMember = hook.myGroupIds.has(groupId);
  const isAdmin = group?.admin.toLowerCase() === myAddr;

  const groupBattles = hook.battles.filter(b => b.scope === BattleScope.GROUP && b.groupId === groupId);

  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState("");
  const [joinSecret, setJoinSecret] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hook.isContractDeployed || !group) return;
      const list = await hook.getGroupMembers(groupId);
      if (!cancelled) setMembers(list);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.isContractDeployed, group?.id, group?.memberCount]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">group</span>
          <p className="text-[#44474E] mb-6">Connect to view this group.</p>
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (!hook.isContractDeployed) {
    return (
      <div className="pt-16 px-8 max-w-3xl mx-auto text-center">
        <p className="text-amber-700 font-bold">Battle market contract not deployed.</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="pt-16 px-8 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl font-extrabold mb-2">Group Not Found</h1>
        <p className="text-slate-500 mb-4">No group exists with id #{groupId}.</p>
        <Link href="/battles" className="text-[#1061FF] underline">
          Back to Arena
        </Link>
      </div>
    );
  }

  const modeLabel =
    group.joinMode === JoinMode.PUBLIC
      ? "Public"
      : group.joinMode === JoinMode.INVITE_LINK
        ? "Invite Link"
        : "Admin Invite";

  return (
    <div className="pt-4 pb-16 px-4 md:px-8 max-w-[1200px] mx-auto">
      <Link href="/battles" className="text-xs text-[#1061FF] font-bold mb-3 inline-flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Arena
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#1061FF] mb-1">Group</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#191C20]">{group.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-[#44474E]">
                {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-extrabold rounded uppercase">
                {modeLabel}
              </span>
              {isAdmin && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded uppercase">
                  You&apos;re Admin
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isMember && (
              <button
                onClick={() => hook.createGroupBattle(groupId)}
                disabled={hook.isProcessing}
                className="px-4 py-2 bg-[#1061FF] text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                + New Group Battle
              </button>
            )}
          </div>
        </div>
      </div>

      {hook.message && (
        <div className="mb-6 bg-[#1061FF]/5 rounded-lg px-4 py-3 text-sm text-[#1061FF] font-medium">
          {hook.message}
        </div>
      )}

      {/* Join area (non-members) */}
      {!isMember && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
          {group.joinMode === JoinMode.PUBLIC ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-amber-900">
                <strong>Public group.</strong> Anyone can join.
              </p>
              <button
                onClick={() => hook.joinGroupPublic(groupId)}
                disabled={hook.isProcessing}
                className="px-4 py-2 bg-[#1061FF] text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Join Group
              </button>
            </div>
          ) : group.joinMode === JoinMode.INVITE_LINK ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-900">
                <strong>Invite-link group.</strong> Paste the secret you received from the admin.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="invite secret"
                  value={joinSecret}
                  onChange={e => setJoinSecret(e.target.value)}
                  className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => hook.joinGroupWithSecret(groupId, joinSecret)}
                  disabled={hook.isProcessing || !joinSecret}
                  className="px-4 py-2 bg-[#1061FF] text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-900">
              <strong>Admin-only group.</strong> Ask the admin to add your address.
            </p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Members list */}
        <div className="lg:col-span-1 bg-white border border-slate-200/60 rounded-xl p-5">
          <h2 className="font-extrabold text-sm uppercase tracking-widest text-[#44474E] mb-3">
            Members ({members.length})
          </h2>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {members.map(addr => {
              const isMe = addr.toLowerCase() === myAddr;
              const isAdminMember = addr.toLowerCase() === group.admin.toLowerCase();
              return (
                <div
                  key={addr}
                  className={`flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded ${
                    isMe ? "bg-[#1061FF]/5" : "hover:bg-slate-50"
                  }`}
                >
                  <span>
                    {addr.slice(0, 6)}...{addr.slice(-4)}
                  </span>
                  <div className="flex gap-1">
                    {isAdminMember && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-extrabold rounded uppercase">
                        Admin
                      </span>
                    )}
                    {isMe && (
                      <span className="px-1.5 py-0.5 bg-[#1061FF]/10 text-[#1061FF] text-[9px] font-extrabold rounded uppercase">
                        You
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Add Member
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="0x..."
                  value={newMember}
                  onChange={e => setNewMember(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-[#1061FF]"
                />
                <button
                  onClick={() => hook.addGroupMember(groupId, newMember.trim())}
                  disabled={hook.isProcessing || !newMember}
                  className="px-3 py-1.5 bg-[#1061FF] text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Battles list */}
        <div className="lg:col-span-2">
          <h2 className="font-extrabold text-sm uppercase tracking-widest text-[#44474E] mb-3">
            Group Battles ({groupBattles.length})
          </h2>
          {groupBattles.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-xl py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">target</span>
              <p className="font-bold text-[#191C20]">No battles in this group yet</p>
              {isMember && (
                <p className="text-sm text-slate-400 mt-1">Hit &ldquo;+ New Group Battle&rdquo; above to start one.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {groupBattles.map(b => {
                const marketsInBattle = hook.markets.filter(m => m.battleId === b.id);
                return (
                  <Link
                    key={b.id}
                    href={`/battles/${b.id}`}
                    className="block bg-white border border-slate-200/60 rounded-xl p-4 hover:border-[#1061FF]/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-[#191C20]">Battle #{b.id}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {marketsInBattle.length} {marketsInBattle.length === 1 ? "market" : "markets"} · created by{" "}
                          <span className="font-mono">
                            {b.creator.slice(0, 6)}...{b.creator.slice(-4)}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full uppercase border ${
                          b.status === BattleStatus.ACTIVE
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                      >
                        {b.status === BattleStatus.ACTIVE ? "Active" : "Cancelled"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
