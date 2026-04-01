import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";

import "./tasks/accounts";

/** Load `packages/hardhat/.env` (ETHERSCAN_API_KEY, DEPLOYER_PRIVATE_KEY, …). */
(function loadLocalEnv() {
  const envPath = resolve(__dirname, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

/** Standard Hardhat account #0 — used for local networks when no valid deployer key is set. */
const HARDHAT_DEV_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function normalizeSecp256k1PrivateKey(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return "";
  return `0x${hex}`;
}

const deployerPk =
  normalizeSecp256k1PrivateKey(process.env.DEPLOYER_PRIVATE_KEY ?? "") ||
  normalizeSecp256k1PrivateKey(vars.get("PRIVATE_KEY", ""));

/** Local + fork networks need a valid key; Sepolia can omit accounts for verify/read-only. */
const localSignerKey = deployerPk || HARDHAT_DEV_PRIVATE_KEY;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  // Single string = Etherscan API v2 (required; per-network map uses deprecated v1).
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || vars.get("ETHERSCAN_API_KEY", ""),
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      accounts: [
        {
          privateKey: localSignerKey,
          balance: "10000000000000000000000",
        },
      ],
      chainId: 31337,
    },
    anvil: {
      accounts: [localSignerKey],
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      ...(deployerPk ? { accounts: [deployerPk] } : {}),
      chainId: 11155111,
      url: "https://ethereum-sepolia-rpc.publicnode.com",
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
