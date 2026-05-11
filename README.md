# Zerk

**Zerk** is an encrypted prediction market on Ethereum Sepolia powered by Zama. Users bet on whether BTC or ETH will be above a strike price at resolution time — or create their own custom markets inside **private groups** and **1v1 battles**. **YES/NO choice and bet size stay encrypted on-chain** using [Zama’s FHEVM](https://docs.zama.ai/protocol); aggregated pool totals are revealed only after resolution for settlement.

---

## [Live Demo](https://zerk-six.vercel.app/)

## [Video Demo](https://www.loom.com/share/8789302d7f8a43329fed1bc5321a9431)

## [Presentation](https://drive.google.com/file/d/1FG6lQIMwVvLOUJim9KJ5GibWARR7_dby/view)

## What we are building

| Layer | Description |
|--------|-------------|
| **Global market** (`ConfidentialPredictionMarket`) | Permissionless market creation + resolution. Anyone can create BTC / ETH price markets backed by **native ETH** or **confidential cUSDC** (Zama’s cUSDC). Encrypted handles for side and amount; totals decrypted publicly after resolve; users decrypt their own positions for claims where needed. |
| **Private arena** (`ConfidentialBattleMarket`) | Two new social primitives: **1v1 Battles** (creator + opponent only) and **Groups** with three join modes (admin-invite / invite-link / public). Inside each battle, members create **price markets** (Chainlink-resolved) or **manual markets** (resolved by the battle creator or group admin) — with the same FHE confidentiality as the global market. |
| **Frontend** | Markets list, market detail (bet / mint / operator / reveal / claim), Arena (battles + groups), per-battle market UI, create-market UI, dashboard (positions + resolve/decrypt panel). |

---

## Why we are building it

Classic prediction markets leak **who bet what** on-chain. That shapes behavior (herding, front-running perception) and reduces the “wisdom of the crowd” signal. **FHE lets the contract compute on ciphertexts** so individual positions stay private while the protocol can still settle payouts using decrypted aggregates and proofs where the design requires it.

---

## How it can help

- **Privacy for participants** — Side and size are not readable from calldata like plaintext bets.
- **Fairer information aggregation** — Less pressure to copy visible whales or hide intent off-chain only.
- **Composable confidentiality** — Same patterns extend to other markets, auctions, or votes where inputs should stay private until a defined reveal phase.

---

## Feature highlights

- **Global confidential markets** — BTC / ETH price markets, ETH or cUSDC collateral, FHE-encrypted bets.
- **Permissionless creation + resolution** — anyone can spin up a market and finalize it once Chainlink prices are deterministic past resolve time.
- **🆕 Arena: 1v1 battles** — challenge a wallet to a private duel; only the two of you can bet.
- **🆕 Arena: groups** — create a friend group with admin-invite, invite-link, or public join mode, then create group-scoped battles.
- **🆕 Manual markets** — inside a battle, create a yes/no question (e.g. *"Will it rain Friday?"*); battle creator (1v1) or group admin resolves manually.
- **End-to-end confidentiality** — encrypted bet side, encrypted bet amount, encrypted per-user payout computation; only aggregate pool totals leak post-resolution.


---

## On-chain contracts (Ethereum Sepolia)

> **Note:** If you redeploy, update `packages/nextjs/contracts/deployedContracts.ts` (and any cron env) so links and configs stay correct.

| Contract | Address | Etherscan |
|----------|---------|-----------|
| **Zerk prediction market** (`ConfidentialPredictionMarket`) | `0x3280aEE5D7Ea04E4ecd2d69cF470E1E02eF9fb8a` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x3280aEE5D7Ea04E4ecd2d69cF470E1E02eF9fb8a) |
| **Zerk Arena — groups + 1v1 battles** (`ConfidentialBattleMarket`) | `0xAE45C0Ae266B4385B193FfC04822E5bCe646c421` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xAE45C0Ae266B4385B193FfC04822E5bCe646c421) |
| **cUSDCMock** (confidential USDC, Zama deployment) | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639) |
| **USDCMock** (underlying mintable for testnet wrap) | `0x9b5cd13b8efbb58dc25a05cf411d8056058adfff` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x9b5cd13b8efbb58dc25a05cf411d8056058adfff) |
| **Chainlink BTC/USD** | `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43) |
| **Chainlink ETH/USD** | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306) |

**Chainlink feed reference:** [Price feed addresses](https://docs.chain.link/data-feeds/price-feeds/addresses) (select Sepolia testnet).

---

## Repository layout

```
├── packages/
│   ├── nextjs/          # Next.js app: /markets, /create, /battles (Arena), /groups, /dashboard, /api/cron/automate
│   ├── hardhat/         # Solidity: PredictionMarket.sol, BattleMarket.sol, deploy + verify scripts, tests
│   └── fhevm-sdk/       # Local FHEVM SDK workspace package
├── pnpm-workspace.yaml
└── README.md
```

---

## Prerequisites

- **Node.js** 20+
- **pnpm**
- **MetaMask** (or compatible wallet) on **Sepolia**
- Sepolia ETH for gas; for cUSDC markets, use the in-app mint/wrap flow and operator setup

---

## Quick start

```bash
git clone <your-repo-url>
cd fhevm-react-template
pnpm install
```

**Frontend (local):**

```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local
# Set at least NEXT_PUBLIC_ALCHEMY_API_KEY (and WalletConnect project ID if you use it)

pnpm start
# or: pnpm --filter ./packages/nextjs dev
```

**Contracts (optional redeploy):**

```bash
# packages/hardhat: set DEPLOYER_PRIVATE_KEY (see packages/hardhat/.env.example)
pnpm deploy:sepolia
# Then regenerate/update packages/nextjs/contracts/deployedContracts.ts as needed
```

---

## Environment variables (Next.js)

See `packages/nextjs/.env.example` for:

- `NEXT_PUBLIC_ALCHEMY_API_KEY` — required for production builds / RPC
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` — optional

---

## Documentation and links

- [Zama Protocol / FHEVM](https://docs.zama.ai/protocol)
- [Relayer SDK](https://docs.zama.ai/protocol/relayer-sdk-guides/)
- [FHEVM Hardhat](https://docs.zama.ai/fhevm/0.6/getting-started/overview-1/hardhat/1.-setting-up-hardhat)
- [Chainlink Data Feeds](https://docs.chain.link/data-feeds)

---

## License

This project is licensed under the **BSD-3-Clause-Clear License**. See [LICENSE](LICENSE).
