# Zerk

**Zerk** is an encrypted prediction market on Ethereum Sepolia powered by Zama. Users bet on whether BTC or ETH will be above a strike price at resolution time. **Yes/No choice and bet size stay encrypted on-chain** using [Zama’s FHEVM](https://docs.zama.ai/protocol); aggregated pool totals are revealed only after resolution for settlement.

---

## [Live Demo](https://zerk-six.vercel.app/)

## [Video Demo](https://www.youtube.com/watch?v=R5JB7pCdTYo)

## [Presentation](https://drive.google.com/file/d/1FG6lQIMwVvLOUJim9KJ5GibWARR7_dby/view)

## What we are building

| Layer | Description |
|--------|-------------|
| **Smart contract** | Owner-created markets; users place bets with **native ETH** or **confidential cUSDC** (Zama’s cUSDCMock). Encrypted handles for side and amount; owner decrypts public totals after resolve; users decrypt their own data for claims where needed. |
| **Frontend** | Markets list, market detail (bet / mint / operator / reveal / claim), owner dashboard (resolve, decrypt totals), create-market UI. |
| **Automation** | API route can resolve expired markets and seed new ±5% strike markets on a cron (see `packages/nextjs/app/api/cron/automate`). |

---

## Why we are building it

Classic prediction markets leak **who bet what** on-chain. That shapes behavior (herding, front-running perception) and reduces the “wisdom of the crowd” signal. **FHE lets the contract compute on ciphertexts** so individual positions stay private while the protocol can still settle payouts using decrypted aggregates and proofs where the design requires it.

---

## How it can help

- **Privacy for participants** — Side and size are not readable from calldata like plaintext bets.
- **Fairer information aggregation** — Less pressure to copy visible whales or hide intent off-chain only.
- **Composable confidentiality** — Same patterns extend to other markets, auctions, or votes where inputs should stay private until a defined reveal phase.


---

## On-chain contracts (Ethereum Sepolia)

> **Note:** If you redeploy, update `packages/nextjs/contracts/deployedContracts.ts` (and any cron env) so links and configs stay correct.

| Contract | Address | Etherscan |
|----------|---------|-----------|
| **Zerk prediction market** (`ConfidentialPredictionMarket`) | `0xa5992143C81fbAd3Bbe55060B1473e587E633a01` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xa5992143C81fbAd3Bbe55060B1473e587E633a01) |
| **cUSDCMock** (confidential USDC, Zama deployment) | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639) |
| **USDCMock** (underlying mintable for testnet wrap) | `0x9b5cd13b8efbb58dc25a05cf411d8056058adfff` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x9b5cd13b8efbb58dc25a05cf411d8056058adfff) |
| **Chainlink BTC/USD** | `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43) |
| **Chainlink ETH/USD** | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306) |

**Chainlink feed reference:** [Price feed addresses](https://docs.chain.link/data-feeds/price-feeds/addresses) (select Sepolia testnet).

---

## Repository layout

```
├── packages/
│   ├── nextjs/          # Next.js app (Zerk UI + `/api/cron/automate`)
│   ├── hardhat/         # Solidity: PredictionMarket.sol, deploy scripts
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
- Cron / QStash: `CRON_OWNER_PRIVATE_KEY`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, optional `CRON_SECRET`

---

## Documentation and links

- [Zama Protocol / FHEVM](https://docs.zama.ai/protocol)
- [Relayer SDK](https://docs.zama.ai/protocol/relayer-sdk-guides/)
- [FHEVM Hardhat](https://docs.zama.ai/fhevm/0.6/getting-started/overview-1/hardhat/1.-setting-up-hardhat)
- [Chainlink Data Feeds](https://docs.chain.link/data-feeds)

---

## License

This project is licensed under the **BSD-3-Clause-Clear License**. See [LICENSE](LICENSE).
