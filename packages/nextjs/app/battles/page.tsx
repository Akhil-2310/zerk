"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import {
  type BattleInfo,
  BattleScope,
  BattleStatus,
  type GroupInfo,
  JoinMode,
  useBattleMarket,
} from "~~/hooks/battle-market/useBattleMarket";

type Tab = "battles" | "groups" | "browse" | "create";

export default function BattlesPage() {
  const { isConnected, address, chain } = useAccount();
  const chainId = chain?.id;

  const provider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).ethereum;
  }, []);

  const initialMockChains = { 31337: "http://localhost:8545" };
  const { instance: fhevmInstance } = useFhevm({ provider, chainId, initialMockChains, enabled: true });

  const {
    groups,
    battles,
    myGroupIds,
    isContractDeployed,
    isProcessing,
    message,
    createGroup,
    createOneVOneBattle,
    acceptBattle,
    cancelBattle,
    joinGroupPublic,
    joinGroupWithSecret,
  } = useBattleMarket({ instance: fhevmInstance, initialMockChains });

  const [tab, setTab] = useState<Tab>("battles");

  // Create battle form
  const [opponentAddr, setOpponentAddr] = useState("");

  // Create group form
  const [groupName, setGroupName] = useState("");
  const [groupJoinMode, setGroupJoinMode] = useState<number>(JoinMode.PUBLIC);
  const [groupSecret, setGroupSecret] = useState("");

  // Join via secret form
  const [joinSecretById, setJoinSecretById] = useState<Record<number, string>>({});

  if (!isConnected) {
    return <ConnectGate />;
  }

  const myAddr = address?.toLowerCase();
  const myBattles = battles.filter(b => b.creator.toLowerCase() === myAddr || b.opponent.toLowerCase() === myAddr);
  const my1v1 = myBattles.filter(b => b.scope === BattleScope.ONE_V_ONE);
  const myGroupBattles = myBattles.filter(b => b.scope === BattleScope.GROUP);

  const myGroupsList = groups.filter(g => myGroupIds.has(g.id));
  const publicGroupsList = groups.filter(g => g.joinMode === JoinMode.PUBLIC && !myGroupIds.has(g.id));
  const linkGroupsList = groups.filter(g => g.joinMode === JoinMode.INVITE_LINK && !myGroupIds.has(g.id));

  return (
    <div className="pt-4 pb-16 px-4 md:px-8 max-w-[1200px] mx-auto">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-widest font-bold text-[#1061FF] mb-1">Arena</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#191C20]">Battles & Groups</h1>
        <p className="text-[#44474E] mt-2 max-w-2xl">
          Challenge a friend 1v1 or create a private group with custom prediction markets — all bets stay encrypted via
          FHE.
        </p>
      </div>

      {!isContractDeployed && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <strong>Battle market contract not deployed yet.</strong> Run{" "}
          <code className="bg-amber-100 px-1.5 py-0.5 rounded">pnpm deploy:sepolia</code> in{" "}
          <code className="bg-amber-100 px-1.5 py-0.5 rounded">packages/hardhat</code> and update the address in{" "}
          <code className="bg-amber-100 px-1.5 py-0.5 rounded">packages/nextjs/contracts/deployedContracts.ts</code>.
        </div>
      )}

      {message && (
        <div className="mb-6 bg-[#1061FF]/5 rounded-lg px-4 py-3 text-sm text-[#1061FF] font-medium">{message}</div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6 overflow-x-auto">
        <TabButton active={tab === "battles"} onClick={() => setTab("battles")}>
          1v1 Battles ({my1v1.length})
        </TabButton>
        <TabButton active={tab === "groups"} onClick={() => setTab("groups")}>
          My Groups ({myGroupsList.length})
        </TabButton>
        <TabButton active={tab === "browse"} onClick={() => setTab("browse")}>
          Browse ({publicGroupsList.length + linkGroupsList.length})
        </TabButton>
        <TabButton active={tab === "create"} onClick={() => setTab("create")}>
          Create
        </TabButton>
      </div>

      {/* TAB: 1v1 BATTLES */}
      {tab === "battles" && (
        <div className="space-y-3">
          {my1v1.length === 0 ? (
            <EmptyState icon="swords" title="No battles yet" hint="Create one in the Create tab." />
          ) : (
            my1v1.map(b => (
              <BattleRow
                key={b.id}
                battle={b}
                myAddr={myAddr}
                isProcessing={isProcessing}
                onAccept={() => acceptBattle(b.id)}
                onCancel={() => cancelBattle(b.id)}
              />
            ))
          )}
        </div>
      )}

      {/* TAB: MY GROUPS (with their group-battles) */}
      {tab === "groups" && (
        <div className="space-y-6">
          {myGroupsList.length === 0 ? (
            <EmptyState icon="group" title="You're not in any group yet" hint="Create one or join via Browse." />
          ) : (
            myGroupsList.map(g => (
              <GroupCard
                key={g.id}
                group={g}
                groupBattles={myGroupBattles.filter(b => b.groupId === g.id)}
                myAddr={myAddr}
              />
            ))
          )}
        </div>
      )}

      {/* TAB: BROWSE PUBLIC + LINK GROUPS */}
      {tab === "browse" && (
        <div className="space-y-6">
          {publicGroupsList.length > 0 && (
            <div>
              <h2 className="font-extrabold text-sm uppercase tracking-widest text-[#44474E] mb-3">Public Groups</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {publicGroupsList.map(g => (
                  <BrowseGroupCard
                    key={g.id}
                    group={g}
                    isProcessing={isProcessing}
                    onJoin={() => joinGroupPublic(g.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {linkGroupsList.length > 0 && (
            <div>
              <h2 className="font-extrabold text-sm uppercase tracking-widest text-[#44474E] mb-3">
                Invite-Link Groups
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {linkGroupsList.map(g => (
                  <div key={g.id} className="bg-white border border-slate-200/60 rounded-xl p-4 flex flex-col gap-3">
                    <div>
                      <p className="font-extrabold text-[#191C20]">{g.name}</p>
                      <p className="text-xs text-[#44474E]">
                        {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste invite secret"
                        value={joinSecretById[g.id] ?? ""}
                        onChange={e => setJoinSecretById(s => ({ ...s, [g.id]: e.target.value }))}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1061FF]"
                      />
                      <button
                        disabled={isProcessing || !joinSecretById[g.id]}
                        onClick={() => joinGroupWithSecret(g.id, joinSecretById[g.id] ?? "")}
                        className="px-4 py-2 bg-[#1061FF] text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {publicGroupsList.length === 0 && linkGroupsList.length === 0 && (
            <EmptyState icon="explore" title="Nothing to browse" hint="No public/link groups exist yet." />
          )}
        </div>
      )}

      {/* TAB: CREATE */}
      {tab === "create" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* 1v1 form */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1061FF]">swords</span>
              <h2 className="font-extrabold text-lg">Challenge to 1v1 Battle</h2>
            </div>
            <p className="text-sm text-[#44474E]">
              Send an on-chain invite to another address. Once they accept, you can both create and bet on markets
              inside the battle.
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Opponent address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={opponentAddr}
                onChange={e => setOpponentAddr(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-[#1061FF]"
              />
            </div>
            <button
              disabled={isProcessing || !opponentAddr || !isContractDeployed}
              onClick={() => createOneVOneBattle(opponentAddr.trim())}
              className="w-full py-3 rounded-xl bg-[#1061FF] text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? "Sending..." : "Send Battle Invite"}
            </button>
          </div>

          {/* Group form */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1061FF]">group_add</span>
              <h2 className="font-extrabold text-lg">Create a Group</h2>
            </div>
            <p className="text-sm text-[#44474E]">
              Groups can have many members. Pick how others can join: admin-only, with a shared link/secret, or open to
              anyone.
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Group name
              </label>
              <input
                type="text"
                placeholder="Crypto Predictions Club"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1061FF]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                Join Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: JoinMode.PUBLIC, l: "Public" },
                  { v: JoinMode.INVITE_LINK, l: "Link" },
                  { v: JoinMode.ADMIN_INVITE, l: "Admin Only" },
                ].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setGroupJoinMode(opt.v)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      groupJoinMode === opt.v
                        ? "bg-[#1061FF]/10 border-[#1061FF] text-[#1061FF]"
                        : "bg-slate-50 border-slate-200 text-[#44474E]"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            {groupJoinMode === JoinMode.INVITE_LINK && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#44474E] mb-1">
                  Invite Secret (share this with people you want to invite)
                </label>
                <input
                  type="text"
                  placeholder="some-shared-secret"
                  value={groupSecret}
                  onChange={e => setGroupSecret(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1061FF]"
                />
                <p className="text-[10px] text-amber-700 mt-1">
                  Only the keccak256 hash is stored on-chain. Anyone you share this secret with can join.
                </p>
              </div>
            )}
            <button
              disabled={
                isProcessing ||
                !groupName ||
                !isContractDeployed ||
                (groupJoinMode === JoinMode.INVITE_LINK && !groupSecret)
              }
              onClick={() =>
                createGroup(
                  groupName,
                  groupJoinMode as any,
                  groupJoinMode === JoinMode.INVITE_LINK ? groupSecret : undefined,
                )
              }
              className="w-full py-3 rounded-xl bg-[#1061FF] text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? "Creating..." : "Create Group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectGate() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
        <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">swords</span>
        <h2 className="text-2xl font-extrabold text-[#191C20] mb-2">Connect Your Wallet</h2>
        <p className="text-[#44474E] mb-6">Connect your wallet to manage battles and groups.</p>
        <div className="flex justify-center">
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 text-sm font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
        active ? "bg-white text-[#191C20] shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl py-16 text-center">
      <span className="material-symbols-outlined text-5xl text-slate-300 mb-3 block">{icon}</span>
      <p className="font-bold text-[#191C20]">{title}</p>
      {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function BattleRow({
  battle,
  myAddr,
  isProcessing,
  onAccept,
  onCancel,
}: {
  battle: BattleInfo;
  myAddr?: string;
  isProcessing: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const iAmCreator = battle.creator.toLowerCase() === myAddr;
  const iAmOpponent = battle.opponent.toLowerCase() === myAddr;
  const isPending = battle.status === BattleStatus.PENDING;
  const isActive = battle.status === BattleStatus.ACTIVE;
  const isCancelled = battle.status === BattleStatus.CANCELLED;

  const other = iAmCreator ? battle.opponent : battle.creator;
  const otherShort = `${other.slice(0, 6)}...${other.slice(-4)}`;

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-lg bg-[#1061FF]/10 flex items-center justify-center text-[#1061FF]">
          <span className="material-symbols-outlined">swords</span>
        </div>
        <div>
          <p className="font-extrabold text-[#191C20]">
            Battle #{battle.id} · vs <span className="font-mono text-sm">{otherShort}</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">You are the {iAmCreator ? "challenger" : "challenged"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill status={battle.status} />
        {isPending && iAmOpponent && (
          <button
            onClick={onAccept}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-[#2E6B5D] text-white text-xs font-bold rounded-lg hover:bg-[#245a4e] disabled:opacity-50 cursor-pointer"
          >
            Accept
          </button>
        )}
        {isPending && iAmCreator && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
        )}
        {isActive && (
          <Link
            href={`/battles/${battle.id}`}
            className="px-3 py-1.5 bg-[#1061FF]/10 text-[#1061FF] text-xs font-bold rounded-lg hover:bg-[#1061FF]/20"
          >
            Open
          </Link>
        )}
        {isCancelled && <span className="text-xs text-slate-400">—</span>}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: number }) {
  const cfg =
    status === BattleStatus.PENDING
      ? { l: "Pending", c: "bg-amber-50 text-amber-700 border-amber-200" }
      : status === BattleStatus.ACTIVE
        ? { l: "Active", c: "bg-green-50 text-green-700 border-green-200" }
        : { l: "Cancelled", c: "bg-slate-50 text-slate-500 border-slate-200" };
  return (
    <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full uppercase border ${cfg.c}`}>{cfg.l}</span>
  );
}

function GroupCard({ group, groupBattles, myAddr }: { group: GroupInfo; groupBattles: BattleInfo[]; myAddr?: string }) {
  const isAdmin = group.admin.toLowerCase() === myAddr;
  const modeLabel =
    group.joinMode === JoinMode.PUBLIC
      ? "Public"
      : group.joinMode === JoinMode.INVITE_LINK
        ? "Invite Link"
        : "Admin Invite";
  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-extrabold text-[#191C20]">{group.name}</p>
            {isAdmin && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded uppercase">
                Admin
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · {modeLabel}
          </p>
        </div>
        <Link
          href={`/groups/${group.id}`}
          className="px-3 py-1.5 bg-[#1061FF]/10 text-[#1061FF] text-xs font-bold rounded-lg hover:bg-[#1061FF]/20"
        >
          Open Group
        </Link>
      </div>
      {groupBattles.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-1.5">
          {groupBattles.map(b => (
            <Link
              key={b.id}
              href={`/battles/${b.id}`}
              className="flex items-center justify-between text-sm py-2 px-3 -mx-1 rounded hover:bg-slate-50"
            >
              <span className="font-medium text-[#191C20]">Battle #{b.id}</span>
              <StatusPill status={b.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function BrowseGroupCard({
  group,
  isProcessing,
  onJoin,
}: {
  group: GroupInfo;
  isProcessing: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-4 flex items-center justify-between gap-3">
      <div>
        <p className="font-extrabold text-[#191C20]">{group.name}</p>
        <p className="text-xs text-slate-500">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · Public
        </p>
      </div>
      <button
        onClick={onJoin}
        disabled={isProcessing}
        className="px-4 py-2 bg-[#1061FF] text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
      >
        Join
      </button>
    </div>
  );
}
