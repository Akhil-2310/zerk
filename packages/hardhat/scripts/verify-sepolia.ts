/**
 * Verifies ConfidentialPredictionMarket on Sepolia using hardhat-deploy artifact.
 *
 * Usage (from packages/hardhat): pnpm verify:sepolia
 */
import { readFileSync } from "fs";
import { join } from "path";
import hre from "hardhat";

async function main() {
  const artifactPath = join(__dirname, "../deployments/sepolia/ConfidentialPredictionMarket.json");
  const deployment = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    address: string;
    args: unknown[];
  };

  console.log("Verifying ConfidentialPredictionMarket at", deployment.address);
  console.log("Constructor args:", deployment.args);

  await hre.run("verify:verify", {
    address: deployment.address,
    constructorArguments: deployment.args,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
