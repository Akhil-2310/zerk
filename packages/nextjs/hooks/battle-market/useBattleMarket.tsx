"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "../helper";
import { CUSDC_ADDRESS } from "../prediction-market/usePredictionMarket";

const CUSDC_ABI = [
  {
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    name: "setOperator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "isOperator",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { toHex, useFHEEncryption } from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

// ---------------------------------------------------------------------------
// Enums (must mirror contracts/BattleMarket.sol)
// ---------------------------------------------------------------------------

export const JoinMode = { ADMIN_INVITE: 0, INVITE_LINK: 1, PUBLIC: 2 } as const;
export type JoinModeValue = (typeof JoinMode)[keyof typeof JoinMode];

export const BattleScope = { ONE_V_ONE: 0, GROUP: 1 } as const;
export type BattleScopeValue = (typeof BattleScope)[keyof typeof BattleScope];

export const BattleStatus = { PENDING: 0, ACTIVE: 1, CANCELLED: 2 } as const;
export type BattleStatusValue = (typeof BattleStatus)[keyof typeof BattleStatus];

export const MarketKind = { BTC_PRICE: 0, ETH_PRICE: 1, MANUAL: 2 } as const;
export type MarketKindValue = (typeof MarketKind)[keyof typeof MarketKind];

export const AssetType = { ETH: 0, CONFIDENTIAL: 1 } as const;
export type AssetTypeValue = (typeof AssetType)[keyof typeof AssetType];

// ---------------------------------------------------------------------------
// Types exposed to the UI
// ---------------------------------------------------------------------------

export interface GroupInfo {
  id: number;
  admin: string;
  name: string;
  joinMode: JoinModeValue;
  inviteHash: string;
  memberCount: number;
}

export interface BattleInfo {
  id: number;
  scope: BattleScopeValue;
  status: BattleStatusValue;
  creator: string;
  opponent: string;
  groupId: number;
}

export interface BattleMarketInfo {
  id: number;
  battleId: number;
  assetType: AssetTypeValue;
  kind: MarketKindValue;
  token: string;
  creator: string;
  strikePrice: string; // human-readable
  strikePriceRaw: bigint;
  question: string;
  resolveTime: string;
  resolveTimestamp: number;
  resolved: boolean;
  outcome: boolean;
  totalsReady: boolean;
  title: string;
}

export interface BattleBetStatus {
  hasBet: boolean;
  claimed: boolean;
  prepared: boolean;
  ethAmount: bigint;
  amountHandle: string;
  sideHandle: string;
}

type BattleMarketContractInfo = Contract<"ConfidentialBattleMarket"> & { chainId?: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMarketTitle(kind: MarketKindValue, strike: bigint, question: string): string {
  if (kind === MarketKind.MANUAL) return question || "Untitled question";
  const usd = (Number(strike) / 1e8).toLocaleString();
  return kind === MarketKind.BTC_PRICE ? `Will BTC hit $${usd}?` : `Will ETH hit $${usd}?`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBattleMarket(parameters?: {
  instance?: FhevmInstance;
  initialMockChains?: Readonly<Record<number, string>>;
}) {
  const instance = parameters?.instance;
  const initialMockChains = parameters?.initialMockChains;
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // Address as a stable string — using `accounts` arrays in dep arrays causes
  // re-render loops because wagmi may return a new array reference each render.
  const userAddress = accounts?.[0];

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: contractInfo } = useDeployedContractInfo({
    contractName: "ConfidentialBattleMarket",
    chainId: allowedChainId,
  });

  const hasContract = Boolean(contractInfo?.address && contractInfo?.abi);
  const isContractDeployed = useMemo(() => {
    if (!hasContract) return false;
    const addr = contractInfo!.address as string;
    return addr !== "0x0000000000000000000000000000000000000000" && addr !== ethers.ZeroAddress;
  }, [hasContract, contractInfo]);
  const hasSigner = Boolean(ethersSigner);

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [battles, setBattles] = useState<BattleInfo[]>([]);
  const [markets, setMarkets] = useState<BattleMarketInfo[]>([]);
  const [betStatuses, setBetStatuses] = useState<Record<number, BattleBetStatus>>({});
  const [revealedData, setRevealedData] = useState<Record<string, bigint | boolean | string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isOperatorSet, setIsOperatorSet] = useState(false);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  const getContract = useCallback(
    (mode: "read" | "write") => {
      if (!isContractDeployed) return undefined;
      const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
      if (!providerOrSigner) return undefined;
      return new ethers.Contract(
        contractInfo!.address,
        (contractInfo as BattleMarketContractInfo).abi as any,
        providerOrSigner,
      );
    },
    [isContractDeployed, contractInfo, ethersReadonlyProvider, ethersSigner],
  );

  // -------------------------------------------------------------------------
  // Counts (groups, battles, markets) — wagmi useReadContract for cheap polling
  // -------------------------------------------------------------------------

  const groupCountResult = useReadContract({
    address: isContractDeployed ? (contractInfo!.address as `0x${string}`) : undefined,
    abi: isContractDeployed ? ((contractInfo as BattleMarketContractInfo).abi as any) : undefined,
    functionName: "groupCount",
    query: { enabled: isContractDeployed },
  });
  const battleCountResult = useReadContract({
    address: isContractDeployed ? (contractInfo!.address as `0x${string}`) : undefined,
    abi: isContractDeployed ? ((contractInfo as BattleMarketContractInfo).abi as any) : undefined,
    functionName: "battleCount",
    query: { enabled: isContractDeployed },
  });
  const marketCountResult = useReadContract({
    address: isContractDeployed ? (contractInfo!.address as `0x${string}`) : undefined,
    abi: isContractDeployed ? ((contractInfo as BattleMarketContractInfo).abi as any) : undefined,
    functionName: "marketCount",
    query: { enabled: isContractDeployed },
  });

  const groupCount = useMemo(() => Number(groupCountResult.data ?? 0), [groupCountResult.data]);
  const battleCount = useMemo(() => Number(battleCountResult.data ?? 0), [battleCountResult.data]);
  const marketCount = useMemo(() => Number(marketCountResult.data ?? 0), [marketCountResult.data]);

  // Refetch counts whenever caller asks
  useEffect(() => {
    groupCountResult.refetch();
    battleCountResult.refetch();
    marketCountResult.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // -------------------------------------------------------------------------
  // Fetch all groups (parallel) + member counts
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isContractDeployed || groupCount === 0) {
      setGroups(prev => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    (async () => {
      const c = getContract("read");
      if (!c) return;
      const groupResults = await Promise.allSettled(Array.from({ length: groupCount }, (_, i) => c.groups(i)));
      const memberCountResults = await Promise.allSettled(
        Array.from({ length: groupCount }, (_, i) => c.groupMemberCount(i)),
      );
      if (cancelled) return;
      const fetched: GroupInfo[] = [];
      for (let i = 0; i < groupResults.length; i++) {
        const r = groupResults[i];
        const m = memberCountResults[i];
        if (r.status !== "fulfilled" || !r.value.exists) continue;
        fetched.push({
          id: i,
          admin: r.value.admin,
          name: r.value.name,
          joinMode: Number(r.value.joinMode) as JoinModeValue,
          inviteHash: r.value.inviteHash,
          memberCount: m.status === "fulfilled" ? Number(m.value) : 0,
        });
      }
      setGroups(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [isContractDeployed, groupCount, getContract]);

  // -------------------------------------------------------------------------
  // Fetch all battles
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isContractDeployed || battleCount === 0) {
      setBattles(prev => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    (async () => {
      const c = getContract("read");
      if (!c) return;
      const results = await Promise.allSettled(Array.from({ length: battleCount }, (_, i) => c.battles(i)));
      if (cancelled) return;
      const fetched: BattleInfo[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== "fulfilled" || !r.value.exists) continue;
        fetched.push({
          id: i,
          scope: Number(r.value.scope) as BattleScopeValue,
          status: Number(r.value.status) as BattleStatusValue,
          creator: r.value.creator,
          opponent: r.value.opponent,
          groupId: Number(r.value.groupId),
        });
      }
      setBattles(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [isContractDeployed, battleCount, getContract]);

  // -------------------------------------------------------------------------
  // Fetch all markets (parallel)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isContractDeployed || marketCount === 0) {
      setMarkets(prev => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const c = getContract("read");
        if (!c) return;
        const results = await Promise.allSettled(Array.from({ length: marketCount }, (_, i) => c.markets(i)));
        if (cancelled) return;
        const fetched: BattleMarketInfo[] = [];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status !== "fulfilled") continue;
          const m = r.value;
          const kind = Number(m.kind) as MarketKindValue;
          const strikeRaw = BigInt(m.strikePrice);
          const resolveTs = Number(m.resolveTime);
          fetched.push({
            id: i,
            battleId: Number(m.battleId),
            assetType: Number(m.assetType) as AssetTypeValue,
            kind,
            token: m.token || "",
            creator: m.creator,
            strikePrice: (Number(strikeRaw) / 1e8).toString(),
            strikePriceRaw: strikeRaw,
            question: m.question || "",
            resolveTime: new Date(resolveTs * 1000).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            resolveTimestamp: resolveTs,
            resolved: m.resolved,
            outcome: m.outcome,
            totalsReady: m.totalsReady,
            title: makeMarketTitle(kind, strikeRaw, m.question || ""),
          });
        }
        setMarkets(fetched);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isContractDeployed, marketCount, getContract]);

  // -------------------------------------------------------------------------
  // Bet statuses for current user (parallel)
  // -------------------------------------------------------------------------

  const fetchBetStatuses = useCallback(async () => {
    if (!isContractDeployed || !userAddress || marketCount === 0) {
      // Idempotent reset — same reference if already empty so wagmi re-renders
      // with same value don't trigger a state change.
      setBetStatuses(prev => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const c = getContract("read");
    if (!c) return;
    const results = await Promise.allSettled(Array.from({ length: marketCount }, (_, i) => c.bets(i, userAddress)));
    const statuses: Record<number, BattleBetStatus> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") continue;
      const b = r.value;
      statuses[i] = {
        hasBet: b.hasBet,
        claimed: b.claimed,
        prepared: b.prepared,
        ethAmount: b.ethAmount,
        amountHandle: b.amount,
        sideHandle: b.side,
      };
    }
    setBetStatuses(statuses);
  }, [isContractDeployed, userAddress, marketCount, getContract]);

  useEffect(() => {
    fetchBetStatuses();
  }, [fetchBetStatuses, refreshTick]);

  // -------------------------------------------------------------------------
  // cUSDC operator status (required for confidentialTransferFrom)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!userAddress || !isContractDeployed || !ethersReadonlyProvider) {
      setIsOperatorSet(prev => (prev === false ? prev : false));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cusdcRead = new ethers.Contract(CUSDC_ADDRESS, CUSDC_ABI, ethersReadonlyProvider);
        const result = await cusdcRead.isOperator(userAddress, contractInfo!.address);
        if (!cancelled) setIsOperatorSet(Boolean(result));
      } catch {
        if (!cancelled) setIsOperatorSet(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userAddress, isContractDeployed, ethersReadonlyProvider, contractInfo, refreshTick]);

  const approveToken = useCallback(async () => {
    if (isProcessing || !ethersSigner || !isContractDeployed) return;
    setIsProcessing(true);
    setMessage("Setting battle market as cUSDC operator...");
    try {
      const cusdcContract = new ethers.Contract(CUSDC_ADDRESS, CUSDC_ABI, ethersSigner);
      const farFuture = 281474976710655; // max uint48
      const tx = await cusdcContract.setOperator(contractInfo!.address, farFuture);
      setMessage("Waiting for operator approval...");
      await tx.wait();
      setIsOperatorSet(true);
      setMessage("Operator approved! You can now create and bet with cUSDC.");
    } catch (e) {
      setMessage(`Approval failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, ethersSigner, isContractDeployed, contractInfo]);

  // -------------------------------------------------------------------------
  // Memberships for current user (which groups they're in)
  // -------------------------------------------------------------------------

  const [myGroupIds, setMyGroupIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isContractDeployed || !userAddress || groupCount === 0) {
      setMyGroupIds(prev => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    (async () => {
      const c = getContract("read");
      if (!c) return;
      const results = await Promise.allSettled(
        Array.from({ length: groupCount }, (_, i) => c.groupMembers(i, userAddress)),
      );
      if (cancelled) return;
      const set = new Set<number>();
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value === true) set.add(i);
      }
      setMyGroupIds(set);
    })();
    return () => {
      cancelled = true;
    };
  }, [isContractDeployed, userAddress, groupCount, getContract]);

  // -------------------------------------------------------------------------
  // Encryption helper
  // -------------------------------------------------------------------------

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: contractInfo?.address,
  });

  // -------------------------------------------------------------------------
  // ACTIONS — Groups
  // -------------------------------------------------------------------------

  const createGroup = useCallback(
    async (name: string, joinMode: JoinModeValue, inviteSecret?: string) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Creating group...");
      try {
        const c = getContract("write");
        if (!c) {
          setMessage("Contract not available");
          return;
        }
        let inviteHash: string = ethers.ZeroHash;
        if (joinMode === JoinMode.INVITE_LINK) {
          if (!inviteSecret) {
            setMessage("Invite-link group needs a secret");
            return;
          }
          inviteHash = ethers.keccak256(ethers.toUtf8Bytes(inviteSecret));
        }
        const tx = await c.createGroup(name, joinMode, inviteHash);
        await tx.wait();
        setMessage("Group created!");
        refresh();
      } catch (e) {
        setMessage(`Create group failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const addGroupMember = useCallback(
    async (groupId: number, member: string) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.addGroupMember(groupId, member);
        await tx.wait();
        setMessage("Member added.");
        refresh();
      } catch (e) {
        setMessage(`Add member failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const joinGroupWithSecret = useCallback(
    async (groupId: number, secret: string) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.joinGroupWithSecret(groupId, ethers.toUtf8Bytes(secret));
        await tx.wait();
        setMessage("Joined group!");
        refresh();
      } catch (e) {
        setMessage(`Join failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const joinGroupPublic = useCallback(
    async (groupId: number) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.joinGroupPublic(groupId);
        await tx.wait();
        setMessage("Joined public group!");
        refresh();
      } catch (e) {
        setMessage(`Join failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const getGroupMembers = useCallback(
    async (groupId: number): Promise<string[]> => {
      const c = getContract("read");
      if (!c) return [];
      try {
        return await c.getGroupMembers(groupId);
      } catch {
        return [];
      }
    },
    [getContract],
  );

  // -------------------------------------------------------------------------
  // ACTIONS — Battles
  // -------------------------------------------------------------------------

  const createOneVOneBattle = useCallback(
    async (opponent: string) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Sending battle invite...");
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.createOneVOneBattle(opponent);
        await tx.wait();
        setMessage("Battle invite sent!");
        refresh();
      } catch (e) {
        setMessage(`Create battle failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const acceptBattle = useCallback(
    async (battleId: number) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.acceptBattle(battleId);
        await tx.wait();
        setMessage("Battle accepted!");
        refresh();
      } catch (e) {
        setMessage(`Accept failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const cancelBattle = useCallback(
    async (battleId: number) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.cancelBattle(battleId);
        await tx.wait();
        setMessage("Battle cancelled.");
        refresh();
      } catch (e) {
        setMessage(`Cancel failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const createGroupBattle = useCallback(
    async (groupId: number) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.createGroupBattle(groupId);
        await tx.wait();
        setMessage("Group battle created!");
        refresh();
      } catch (e) {
        setMessage(`Create group battle failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  // -------------------------------------------------------------------------
  // ACTIONS — Markets
  // -------------------------------------------------------------------------

  const createMarketETH = useCallback(
    async (
      battleId: number,
      kind: MarketKindValue,
      strikePrice: bigint,
      question: string,
      resolveTime: bigint,
      seedYes: bigint,
      seedNo: bigint,
    ) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Creating ETH market...");
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.createMarketETH(battleId, kind, strikePrice, question, resolveTime, seedYes, seedNo, {
          value: seedYes + seedNo,
        });
        await tx.wait();
        setMessage("Market created!");
        refresh();
      } catch (e) {
        setMessage(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const createMarketToken = useCallback(
    async (
      battleId: number,
      kind: MarketKindValue,
      strikePrice: bigint,
      question: string,
      resolveTime: bigint,
      seedYes: bigint,
      seedNo: bigint,
    ) => {
      if (isProcessing || !hasSigner || !instance) return;
      setIsProcessing(true);
      setMessage("Encrypting cUSDC seeds...");
      try {
        const enc = await encryptWith(builder => {
          (builder as any).add64(seedYes);
          (builder as any).add64(seedNo);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }
        const c = getContract("write");
        if (!c) return;
        setMessage("Creating cUSDC market...");
        const tx = await c.createMarketToken(
          battleId,
          kind,
          CUSDC_ADDRESS,
          strikePrice,
          question,
          resolveTime,
          toHex(enc.handles[0]),
          toHex(enc.handles[1]),
          toHex(enc.inputProof),
        );
        await tx.wait();
        setMessage("cUSDC market created!");
        refresh();
      } catch (e) {
        setMessage(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, instance, encryptWith, getContract, refresh],
  );

  const placeBetETH = useCallback(
    async (marketId: number, side: boolean, amount: bigint) => {
      if (isProcessing || !hasSigner || !instance) return;
      setIsProcessing(true);
      setMessage("Encrypting your side...");
      try {
        const enc = await encryptWith(builder => (builder as any).addBool(side));
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }
        const c = getContract("write");
        if (!c) return;
        setMessage("Placing encrypted bet...");
        const tx = await c.placeBetETH(marketId, toHex(enc.handles[0]), toHex(enc.inputProof), { value: amount });
        await tx.wait();
        setMessage("Bet placed!");
        refresh();
      } catch (e) {
        setMessage(`Bet failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, instance, encryptWith, getContract, refresh],
  );

  const placeBetToken = useCallback(
    async (marketId: number, side: boolean, amount: bigint) => {
      if (isProcessing || !hasSigner || !instance) return;
      setIsProcessing(true);
      setMessage("Encrypting amount + side...");
      try {
        const enc = await encryptWith(builder => {
          (builder as any).add64(amount);
          (builder as any).addBool(side);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }
        const c = getContract("write");
        if (!c) return;
        setMessage("Placing encrypted bet...");
        const tx = await c.placeBetToken(marketId, toHex(enc.handles[0]), toHex(enc.handles[1]), toHex(enc.inputProof));
        await tx.wait();
        setMessage("Bet placed!");
        refresh();
      } catch (e) {
        setMessage(`Bet failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, instance, encryptWith, getContract, refresh],
  );

  const resolvePriceMarket = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Resolving via Chainlink oracle...");
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.resolvePriceMarket(marketId);
        await tx.wait();
        setMessage("Resolved! Decrypt totals next.");
        refresh();
      } catch (e) {
        setMessage(`Resolve failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const resolveManualMarket = useCallback(
    async (marketId: number, outcome: boolean) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Resolving manually...");
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.resolveManualMarket(marketId, outcome);
        await tx.wait();
        setMessage(`Resolved as ${outcome ? "YES" : "NO"}!`);
        refresh();
      } catch (e) {
        setMessage(`Resolve failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  const submitTotals = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasSigner || !instance) return;
      setIsProcessing(true);
      try {
        const c = getContract("read");
        if (!c) return;
        setMessage("Fetching encrypted total handles...");
        const { yesHandle, noHandle } = await c.getTotalHandles(marketId);
        setMessage("Requesting public decryption from KMS (~30s)...");
        const result = await instance.publicDecrypt([yesHandle, noHandle]);
        const w = getContract("write");
        if (!w) return;
        setMessage("Submitting decrypted totals on-chain...");
        const tx = await w.submitTotals(marketId, result.abiEncodedClearValues, result.decryptionProof);
        await tx.wait();
        setMessage("Totals submitted! Users can now claim.");
        refresh();
      } catch (e) {
        setMessage(`Decrypt totals failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, instance, getContract, refresh],
  );

  const prepareAndClaimETH = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasSigner || !instance) return;
      setIsProcessing(true);
      try {
        const r = getContract("read");
        const w = getContract("write");
        if (!r || !w) return;
        const userAddress = accounts?.[0];
        if (!userAddress) {
          setMessage("Wallet not connected");
          return;
        }
        const existing = await r.getWinHandle(marketId, userAddress);
        if (existing === ethers.ZeroHash) {
          setMessage("Step 1/3: Computing encrypted win on-chain...");
          const prep = await w.prepareClaimETH(marketId);
          await prep.wait();
        }
        setMessage("Step 2/3: Decrypting your win via KMS (~30s)...");
        const winHandle = await r.getWinHandle(marketId, userAddress);
        const result = await instance.publicDecrypt([winHandle]);
        const won = result.clearValues[winHandle as `0x${string}`];
        setMessage(`Step 3/3: ${won ? "You won! Claiming payout..." : "Finalizing claim (no payout)..."}`);
        const claim = await w.claimETH(marketId, result.abiEncodedClearValues, result.decryptionProof);
        await claim.wait();
        setMessage(won ? "Payout received!" : "Claim processed (no payout).");
        refresh();
      } catch (e) {
        setMessage(`Claim failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, instance, getContract, accounts, refresh],
  );

  const claimToken = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Claiming encrypted cUSDC payout...");
      try {
        const c = getContract("write");
        if (!c) return;
        const tx = await c.claimToken(marketId);
        await tx.wait();
        setMessage("Claim complete (encrypted payout sent).");
        refresh();
      } catch (e) {
        setMessage(`Claim failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, getContract, refresh],
  );

  // -------------------------------------------------------------------------
  // Reveal a user's encrypted bet (side + amount for cUSDC)
  // -------------------------------------------------------------------------

  const revealBet = useCallback(
    async (marketId: number) => {
      if (isProcessing || !instance || !ethersSigner || !accounts?.[0]) return;
      setIsProcessing(true);
      setMessage("Preparing decryption request...");
      try {
        const bet = betStatuses[marketId];
        if (!bet?.hasBet) {
          setMessage("No bet on this market.");
          return;
        }
        const market = markets.find(m => m.id === marketId);
        const contractAddr = contractInfo!.address;
        const userAddr = accounts[0];

        const handles: { handle: string; contractAddress: string }[] = [
          { handle: bet.sideHandle, contractAddress: contractAddr },
        ];
        if (market?.assetType === AssetType.CONFIDENTIAL) {
          handles.push({ handle: bet.amountHandle, contractAddress: contractAddr });
        }

        const keypair = instance.generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000);
        const eip712 = instance.createEIP712(keypair.publicKey, [contractAddr], startTimestamp, 1);

        setMessage("Please sign the decryption request...");
        // Strip EIP712Domain — ethers v6 fills it in itself.
        const allTypes = eip712.types as any;
        const typesWithoutDomain = Object.fromEntries(Object.entries(allTypes).filter(([k]) => k !== "EIP712Domain"));
        const signature = await ethersSigner.signTypedData(
          eip712.domain as any,
          typesWithoutDomain as any,
          eip712.message as any,
        );

        setMessage("Decrypting via KMS (~30s)...");
        const result = await instance.userDecrypt(
          handles,
          keypair.privateKey,
          keypair.publicKey,
          signature,
          [contractAddr],
          userAddr,
          startTimestamp,
          1,
        );

        const next = { ...revealedData };
        const sideKey = `${marketId}-side`;
        const sideVal =
          result[bet.sideHandle.toLowerCase() as `0x${string}`] ?? result[bet.sideHandle as `0x${string}`];
        if (sideVal !== undefined) next[sideKey] = sideVal;

        if (market?.assetType === AssetType.CONFIDENTIAL) {
          const amtKey = `${marketId}-amount`;
          const amtVal =
            result[bet.amountHandle.toLowerCase() as `0x${string}`] ?? result[bet.amountHandle as `0x${string}`];
          if (amtVal !== undefined) next[amtKey] = amtVal;
        }

        setRevealedData(next);
        setMessage("Bet revealed!");
      } catch (e) {
        setMessage(`Reveal failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, instance, ethersSigner, accounts, betStatuses, markets, contractInfo, revealedData],
  );

  // -------------------------------------------------------------------------

  return {
    // state
    groups,
    battles,
    markets,
    betStatuses,
    revealedData,
    myGroupIds,
    isLoading,
    isProcessing,
    isConnected,
    isContractDeployed,
    isOperatorSet,
    message,
    chainId,
    accounts,
    contractAddress: contractInfo?.address,
    // actions — token operator (cUSDC)
    approveToken,
    // actions — groups
    createGroup,
    addGroupMember,
    joinGroupWithSecret,
    joinGroupPublic,
    getGroupMembers,
    // actions — battles
    createOneVOneBattle,
    acceptBattle,
    cancelBattle,
    createGroupBattle,
    // actions — markets
    createMarketETH,
    createMarketToken,
    placeBetETH,
    placeBetToken,
    resolvePriceMarket,
    resolveManualMarket,
    submitTotals,
    prepareAndClaimETH,
    claimToken,
    revealBet,
    // utilities
    refresh,
    refreshBetStatuses: fetchBetStatuses,
  };
}
