"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "../helper";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { toHex, useFHEEncryption, useInMemoryStorage } from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { useReadContract } from "wagmi";

export const CUSDC_ADDRESS = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
export const USDC_MOCK_ADDRESS = "0x9b5cd13b8efbb58dc25a05cf411d8056058adfff";

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
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "wrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const USDC_MOCK_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export interface MarketInfo {
  id: number;
  title: string;
  marketType: string;
  assetType: string;
  strikePrice: string;
  resolveTime: string;
  resolveTimestamp: number;
  resolved: boolean;
  outcome: boolean;
  totalsReady: boolean;
  tag: string;
  icon: string;
  iconBg: string;
  tokenAddress: string;
}

export interface BetStatus {
  hasBet: boolean;
  claimed: boolean;
  prepared: boolean;
  ethAmount: bigint;
  amountHandle: string;
  sideHandle: string;
}

type PredictionMarketContractInfo = Contract<"ConfidentialPredictionMarket"> & { chainId?: number };

const EMPTY_RESULT = {
  markets: [] as MarketInfo[],
  betStatuses: {} as Record<number, BetStatus>,
  revealedData: {} as Record<string, bigint | boolean | string>,
  isLoading: false,
  isOwner: false,
  isProcessing: false,
  isOperatorSet: false,
  message: "",
  placeBetETH: async (_id: number, _side: boolean, _amount: bigint) => {},
  placeBetToken: async (_id: number, _side: boolean, _amount: bigint) => {},
  createMarketETH: async (_type: number, _strike: bigint, _resolve: bigint, _seedYes: bigint, _seedNo: bigint) => {},
  createMarketToken: async (_type: number, _token: string, _strike: bigint, _resolve: bigint, _seedYes: bigint, _seedNo: bigint) => {},
  approveToken: async () => {},
  mintAndWrapCUSDC: async (_amount: bigint) => {},
  resolveMarket: async (_id: number) => {},
  submitTotals: async (_id: number) => {},
  prepareAndClaimETH: async (_id: number) => {},
  claimToken: async (_id: number) => {},
  revealBet: async (_id: number) => {},
  refreshBetStatuses: async () => {},
};

export function usePredictionMarket(parameters?: {
  instance?: FhevmInstance;
  initialMockChains?: Readonly<Record<number, string>>;
}) {
  const instance = parameters?.instance;
  const initialMockChains = parameters?.initialMockChains;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: contractInfo } = useDeployedContractInfo({
    contractName: "ConfidentialPredictionMarket",
    chainId: allowedChainId,
  });

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [betStatuses, setBetStatuses] = useState<Record<number, BetStatus>>({});
  const [isOperatorSet, setIsOperatorSet] = useState(false);
  const [revealedData, setRevealedData] = useState<Record<string, bigint | boolean | string>>({});

  const hasContract = Boolean(contractInfo?.address && contractInfo?.abi);
  const hasSigner = Boolean(ethersSigner);

  const getContract = useCallback(
    (mode: "read" | "write") => {
      if (!hasContract) return undefined;
      const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
      if (!providerOrSigner) return undefined;
      return new ethers.Contract(
        contractInfo!.address,
        (contractInfo as PredictionMarketContractInfo).abi as any,
        providerOrSigner,
      );
    },
    [hasContract, contractInfo, ethersReadonlyProvider, ethersSigner],
  );

  const ownerResult = useReadContract({
    address: hasContract ? (contractInfo!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((contractInfo as PredictionMarketContractInfo).abi as any) : undefined,
    functionName: "owner",
    query: { enabled: hasContract },
  });

  const isOwner = useMemo(() => {
    if (!accounts?.[0] || !ownerResult.data) return false;
    return (ownerResult.data as string).toLowerCase() === accounts[0].toLowerCase();
  }, [accounts, ownerResult.data]);

  const marketCountResult = useReadContract({
    address: hasContract ? (contractInfo!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((contractInfo as PredictionMarketContractInfo).abi as any) : undefined,
    functionName: "marketCount",
    query: { enabled: hasContract },
  });

  const marketCount = useMemo(() => {
    return marketCountResult.data ? Number(marketCountResult.data) : 0;
  }, [marketCountResult.data]);

  // Fetch market details
  useEffect(() => {
    if (!hasContract || marketCount === 0) {
      setMarkets([]);
      return;
    }

    const fetchMarkets = async () => {
      setIsLoading(true);
      try {
        const readContract = getContract("read");
        if (!readContract) return;

        const fetched: MarketInfo[] = [];
        for (let i = 0; i < marketCount; i++) {
          try {
            const m = await readContract.markets(i);
            const marketTypeStr = Number(m.marketType) === 0 ? "BTC_PRICE" : "ETH_PRICE";
            const assetTypeStr = Number(m.assetType) === 0 ? "ETH" : "CONFIDENTIAL";
            const resolveTimestamp = Number(m.resolveTime);

            fetched.push({
              id: i,
              title:
                marketTypeStr === "BTC_PRICE"
                  ? `Will Bitcoin hit $${(Number(m.strikePrice) / 1e8).toLocaleString()}?`
                  : `Will Ethereum hit $${(Number(m.strikePrice) / 1e8).toLocaleString()}?`,
              marketType: marketTypeStr,
              assetType: assetTypeStr,
              strikePrice: (Number(m.strikePrice) / 1e8).toString(),
              resolveTime: new Date(resolveTimestamp * 1000).toLocaleDateString("en-US", { dateStyle: "medium" }),
              resolveTimestamp,
              resolved: m.resolved,
              outcome: m.outcome,
              totalsReady: m.totalsReady,
              tag: marketTypeStr === "BTC_PRICE" ? "Bitcoin" : "Ethereum",
              icon: marketTypeStr === "BTC_PRICE" ? "₿" : "Ξ",
              iconBg: marketTypeStr === "BTC_PRICE" ? "bg-orange-100" : "bg-blue-100",
              tokenAddress: m.token || "",
            });
          } catch (e) {
            console.error(`Failed to fetch market ${i}:`, e);
          }
        }
        setMarkets(fetched);
      } catch (e) {
        console.error("Failed to fetch markets:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkets();
  }, [hasContract, marketCount, getContract]);

  // Fetch bet statuses for the connected user
  const fetchBetStatuses = useCallback(async () => {
    if (!hasContract || !accounts?.[0] || marketCount === 0) return;
    const readContract = getContract("read");
    if (!readContract) return;

    const statuses: Record<number, BetStatus> = {};
    for (let i = 0; i < marketCount; i++) {
      try {
        const b = await readContract.bets(i, accounts[0]);
        statuses[i] = {
          hasBet: b.hasBet,
          claimed: b.claimed,
          prepared: b.prepared,
          ethAmount: b.ethAmount,
          amountHandle: b.amount,
          sideHandle: b.side,
        };
      } catch {
        // ignore individual failures
      }
    }
    setBetStatuses(statuses);
  }, [hasContract, accounts, marketCount, getContract]);

  useEffect(() => {
    fetchBetStatuses();
  }, [fetchBetStatuses]);

  // Auto-detect operator status
  useEffect(() => {
    if (!accounts?.[0] || !hasContract || !ethersReadonlyProvider) return;

    const checkOperator = async () => {
      try {
        const cusdcRead = new ethers.Contract(CUSDC_ADDRESS, CUSDC_ABI, ethersReadonlyProvider);
        const result = await cusdcRead.isOperator(accounts[0], contractInfo!.address);
        setIsOperatorSet(result);
      } catch {
        setIsOperatorSet(false);
      }
    };
    checkOperator();
  }, [accounts, hasContract, ethersReadonlyProvider, contractInfo]);

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: contractInfo?.address,
  });

  const placeBetETH = useCallback(
    async (marketId: number, side: boolean, amount: bigint) => {
      if (isProcessing || !hasContract || !instance || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Encrypting your bet (side)...");
      try {
        const enc = await encryptWith(builder => {
          (builder as any).addBool(side);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract or signer not available");
          return;
        }

        const encryptedSide = toHex(enc.handles[0]);
        const inputProof = toHex(enc.inputProof);

        setMessage("Placing encrypted bet...");
        const tx = await writeContract.placeBetETH(marketId, encryptedSide, inputProof, { value: amount });
        setMessage("Waiting for confirmation...");
        await tx.wait();
        setMessage("Bet placed successfully! Your side and amount are encrypted on-chain.");
        marketCountResult.refetch();
        fetchBetStatuses();
      } catch (e) {
        setMessage(`Bet failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, instance, hasSigner, encryptWith, getContract, marketCountResult, fetchBetStatuses],
  );

  const placeBetToken = useCallback(
    async (marketId: number, side: boolean, amount: bigint) => {
      if (isProcessing || !hasContract || !instance || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Encrypting your bet (amount + side)...");
      try {
        const enc = await encryptWith(builder => {
          (builder as any).add64(amount);
          (builder as any).addBool(side);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract or signer not available");
          return;
        }

        const encryptedAmount = toHex(enc.handles[0]);
        const encryptedSide = toHex(enc.handles[1]);
        const inputProof = toHex(enc.inputProof);

        setMessage("Placing encrypted bet...");
        const tx = await writeContract.placeBetToken(marketId, encryptedAmount, encryptedSide, inputProof);
        setMessage("Waiting for confirmation...");
        await tx.wait();
        setMessage("Bet placed successfully! Your side and amount are encrypted on-chain.");
        marketCountResult.refetch();
        fetchBetStatuses();
      } catch (e) {
        setMessage(`Bet failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, instance, hasSigner, encryptWith, getContract, marketCountResult, fetchBetStatuses],
  );

  const approveToken = useCallback(async () => {
    if (isProcessing || !hasSigner || !hasContract) return;
    setIsProcessing(true);
    setMessage("Setting prediction market as cUSDCMock operator...");
    try {
      if (!ethersSigner) {
        setMessage("Signer not available");
        return;
      }

      const cusdcContract = new ethers.Contract(CUSDC_ADDRESS, CUSDC_ABI, ethersSigner);
      const farFuture = 281474976710655;
      const tx = await cusdcContract.setOperator(contractInfo!.address, farFuture);
      setMessage("Waiting for operator approval...");
      await tx.wait();
      setIsOperatorSet(true);
      setMessage("Operator set! The prediction market can now transfer your cUSDCMock.");
    } catch (e) {
      setMessage(`Operator approval failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, hasSigner, hasContract, ethersSigner, contractInfo]);

  const mintAndWrapCUSDC = useCallback(
    async (amount: bigint) => {
      if (isProcessing || !hasSigner) return;
      setIsProcessing(true);
      try {
        if (!ethersSigner) {
          setMessage("Signer not available");
          return;
        }

        const userAddress = await ethersSigner.getAddress();
        const usdcMock = new ethers.Contract(USDC_MOCK_ADDRESS, USDC_MOCK_ABI, ethersSigner);
        const cusdcMock = new ethers.Contract(CUSDC_ADDRESS, CUSDC_ABI, ethersSigner);

        setMessage("Step 1/3: Minting USDCMock...");
        const mintTx = await usdcMock.mint(userAddress, amount);
        await mintTx.wait();

        setMessage("Step 2/3: Approving wrapper to spend USDCMock...");
        const approveTx = await usdcMock.approve(CUSDC_ADDRESS, amount);
        await approveTx.wait();

        setMessage("Step 3/3: Wrapping USDCMock into cUSDCMock...");
        const wrapTx = await cusdcMock.wrap(userAddress, amount);
        await wrapTx.wait();

        setMessage(`Successfully minted & wrapped ${Number(amount) / 1e6} cUSDCMock!`);
      } catch (e) {
        setMessage(`Mint & wrap failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, ethersSigner],
  );

  const createMarketETH = useCallback(
    async (marketType: number, strikePrice: bigint, resolveTime: bigint, seedYes: bigint, seedNo: bigint) => {
      if (isProcessing || !hasContract || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Creating ETH market...");
      try {
        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract or signer not available");
          return;
        }

        const tx = await writeContract.createMarketETH(marketType, strikePrice, resolveTime, seedYes, seedNo, {
          value: seedYes + seedNo,
        });
        setMessage("Waiting for confirmation...");
        await tx.wait();
        setMessage("Market created successfully!");
        marketCountResult.refetch();
      } catch (e) {
        setMessage(`Market creation failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, hasSigner, getContract, marketCountResult],
  );

  const createMarketToken = useCallback(
    async (
      marketType: number,
      tokenAddress: string,
      strikePrice: bigint,
      resolveTime: bigint,
      seedYes: bigint,
      seedNo: bigint,
    ) => {
      if (isProcessing || !hasContract || !instance || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Encrypting seed amounts...");
      try {
        const enc = await encryptWith(builder => {
          (builder as any).add64(seedYes);
          (builder as any).add64(seedNo);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract or signer not available");
          return;
        }

        const encryptedSeedYes = toHex(enc.handles[0]);
        const encryptedSeedNo = toHex(enc.handles[1]);
        const inputProof = toHex(enc.inputProof);

        setMessage("Creating confidential token market...");
        const tx = await writeContract.createMarketToken(
          marketType,
          tokenAddress,
          strikePrice,
          resolveTime,
          encryptedSeedYes,
          encryptedSeedNo,
          inputProof,
        );
        setMessage("Waiting for confirmation...");
        await tx.wait();
        setMessage("Market created successfully!");
        marketCountResult.refetch();
      } catch (e) {
        setMessage(`Market creation failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, instance, hasSigner, encryptWith, getContract, marketCountResult],
  );

  const resolveMarket = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasContract || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Resolving market via Chainlink oracle...");
      try {
        const writeContract = getContract("write");
        if (!writeContract) return;
        const tx = await writeContract.resolveMarket(marketId);
        setMessage("Waiting for confirmation...");
        await tx.wait();
        setMessage("Market resolved! Now decrypt totals to enable claims.");
        marketCountResult.refetch();
      } catch (e) {
        setMessage(`Resolution failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, hasSigner, getContract, marketCountResult],
  );

  const submitTotals = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasContract || !hasSigner || !instance) return;
      setIsProcessing(true);
      try {
        const readContract = getContract("read");
        if (!readContract) {
          setMessage("Contract not available");
          return;
        }

        setMessage("Fetching encrypted total handles...");
        const { yesHandle, noHandle } = await readContract.getTotalHandles(marketId);

        setMessage("Requesting public decryption from KMS (this may take ~30s)...");
        const result = await instance.publicDecrypt([yesHandle, noHandle]);

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Signer not available");
          return;
        }

        setMessage("Submitting decrypted totals + proof on-chain...");
        const tx = await writeContract.submitTotals(marketId, result.abiEncodedClearValues, result.decryptionProof);
        setMessage("Waiting for confirmation...");
        await tx.wait();
        setMessage("Totals submitted! Users can now claim their winnings.");
        marketCountResult.refetch();
      } catch (e) {
        console.error("submitTotals error:", e);
        setMessage(`Decrypt totals failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, hasSigner, instance, getContract, marketCountResult],
  );

  const prepareAndClaimETH = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasContract || !hasSigner || !instance) return;
      setIsProcessing(true);
      try {
        const readContract = getContract("read");
        const writeContract = getContract("write");
        if (!readContract || !writeContract) {
          setMessage("Contract not available");
          return;
        }

        const userAddress = accounts?.[0];
        if (!userAddress) {
          setMessage("Wallet not connected");
          return;
        }

        const existingHandle = await readContract.getWinHandle(marketId, userAddress);
        const isAlreadyPrepared = existingHandle !== ethers.ZeroHash;

        if (!isAlreadyPrepared) {
          setMessage("Step 1/3: Computing your encrypted win result on-chain...");
          const prepareTx = await writeContract.prepareClaimETH(marketId);
          await prepareTx.wait();
        }

        setMessage("Step 2/3: Decrypting your win result via KMS (~30s)...");
        const winHandle = await readContract.getWinHandle(marketId, userAddress);

        const result = await instance.publicDecrypt([winHandle]);
        const won = result.clearValues[winHandle as `0x${string}`];

        setMessage(`Step 3/3: ${won ? "You won! Claiming payout..." : "Finalizing claim (no payout)..."}`);
        const claimTx = await writeContract.claimETH(marketId, result.abiEncodedClearValues, result.decryptionProof);
        await claimTx.wait();

        setMessage(won ? "Payout received! Check your wallet." : "Claim processed. You did not win this time.");
        marketCountResult.refetch();
        fetchBetStatuses();
      } catch (e) {
        console.error("prepareAndClaimETH error:", e);
        setMessage(`Claim failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, hasSigner, instance, getContract, accounts, marketCountResult, fetchBetStatuses],
  );

  const claimToken = useCallback(
    async (marketId: number) => {
      if (isProcessing || !hasContract || !hasSigner) return;
      setIsProcessing(true);
      setMessage("Claiming token rewards (payout computed in encrypted form)...");
      try {
        const writeContract = getContract("write");
        if (!writeContract) return;
        const tx = await writeContract.claimToken(marketId);
        await tx.wait();
        setMessage("Token claim submitted! Your encrypted payout has been sent.");
        fetchBetStatuses();
      } catch (e) {
        setMessage(`Claim failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasContract, hasSigner, getContract, fetchBetStatuses],
  );

  // On-demand reveal: decrypt bet side (and amount for cUSDC) via user decryption
  const revealBet = useCallback(
    async (marketId: number) => {
      if (isProcessing || !instance || !ethersSigner || !hasContract || !accounts?.[0]) return;
      setIsProcessing(true);
      setMessage("Preparing decryption request...");
      try {
        const bet = betStatuses[marketId];
        if (!bet?.hasBet) {
          setMessage("No bet found for this market.");
          return;
        }

        const contractAddr = contractInfo!.address;
        const userAddr = accounts[0];

        const handles: { handle: string; contractAddress: string }[] = [
          { handle: bet.sideHandle, contractAddress: contractAddr },
        ];

        const market = markets.find(m => m.id === marketId);
        if (market?.assetType === "CONFIDENTIAL") {
          handles.push({ handle: bet.amountHandle, contractAddress: contractAddr });
        }

        const keypair = instance.generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000);

        const eip712 = instance.createEIP712(keypair.publicKey, [contractAddr], startTimestamp, 1);

        setMessage("Please sign the decryption request in your wallet...");
        const { EIP712Domain, ...typesWithoutDomain } = eip712.types as any;
        const signature = await ethersSigner.signTypedData(eip712.domain as any, typesWithoutDomain, eip712.message as any);

        setMessage("Decrypting your bet via KMS (this may take ~30s)...");
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

        const newRevealed = { ...revealedData };
        const sideKey = `${marketId}-side`;
        const sideVal = result[bet.sideHandle.toLowerCase() as `0x${string}`] ?? result[bet.sideHandle as `0x${string}`];
        if (sideVal !== undefined) {
          newRevealed[sideKey] = sideVal;
        }

        if (market?.assetType === "CONFIDENTIAL") {
          const amtKey = `${marketId}-amount`;
          const amtVal =
            result[bet.amountHandle.toLowerCase() as `0x${string}`] ?? result[bet.amountHandle as `0x${string}`];
          if (amtVal !== undefined) {
            newRevealed[amtKey] = amtVal;
          }
        }

        setRevealedData(newRevealed);
        setMessage("Bet revealed successfully!");
      } catch (e) {
        console.error("revealBet error:", e);
        setMessage(`Reveal failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, instance, ethersSigner, hasContract, accounts, betStatuses, contractInfo, markets, revealedData],
  );

  return {
    markets,
    betStatuses,
    revealedData,
    isLoading,
    isOwner,
    isProcessing,
    isOperatorSet,
    message,
    placeBetETH,
    placeBetToken,
    approveToken,
    mintAndWrapCUSDC,
    createMarketETH,
    createMarketToken,
    resolveMarket,
    submitTotals,
    prepareAndClaimETH,
    claimToken,
    revealBet,
    refreshBetStatuses: fetchBetStatuses,
    contractAddress: contractInfo?.address,
    chainId,
    accounts,
    isConnected,
  };
}
