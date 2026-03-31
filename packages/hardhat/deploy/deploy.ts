import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Chainlink V3 Price Feed addresses
// See: https://docs.chain.link/data-feeds/price-feeds/addresses
const CHAINLINK_FEEDS: Record<string, { btc: string; eth: string }> = {
  // Ethereum Sepolia
  "11155111": {
    btc: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43", // BTC/USD
    eth: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // ETH/USD
  },
  // Ethereum Mainnet (for future reference)
  "1": {
    btc: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", // BTC/USD
    eth: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH/USD
  },
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const chainId = await hre.getChainId();
  const feeds = CHAINLINK_FEEDS[chainId];

  if (!feeds) {
    throw new Error(
      `No Chainlink price feed addresses configured for chainId ${chainId}. ` +
        `Supported chains: ${Object.keys(CHAINLINK_FEEDS).join(", ")}`,
    );
  }

  console.log(`Deploying ConfidentialPredictionMarket on chain ${chainId}...`);
  console.log(`  BTC/USD feed: ${feeds.btc}`);
  console.log(`  ETH/USD feed: ${feeds.eth}`);
  console.log(`  Deployer:     ${deployer}`);

  const deployedContract = await deploy("ConfidentialPredictionMarket", {
    from: deployer,
    args: [feeds.btc, feeds.eth],
    log: true,
  });

  console.log(`ConfidentialPredictionMarket deployed at: ${deployedContract.address}`);
};

export default func;
func.id = "deploy_prediction_market";
func.tags = ["ConfidentialPredictionMarket"];
