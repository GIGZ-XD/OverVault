/**
 * deploy.js — OverVault Smart Contract Deployment Script (Hardhat 3)
 *
 * Deploys all four OverVault contracts in the required order:
 *   1. Ownership.sol   : File ownership registry
 *   2. Permission.sol  : Access-control permission management
 *   3. Integrity.sol   : Document content hash anchoring
 *   4. Audit.sol       : Append-only audit log
 *
 * Usage:
 *   # Local Hardhat network (testing):
 *   npx hardhat --network hardhat run scripts/deploy.js
 *
 *   # MST EVM Testnet:
 *   npx hardhat run scripts/deploy.js --network mst_testnet
 *
 * Output:
 *   - Prints contract names and deployed addresses to stdout.
 *   - Saves deployment record to contracts/deployed.<network>.json and contracts/deployed.testnet.json.
 *   - Prints the configuration values for backend .env.
 *
 * Owner: Sriganesh (Blockchain & Audit Engineer).
 */

import hre, { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const targetNetwork = hre.globalOptions.network || "mst_testnet";
  const conn = await network.getOrCreate(targetNetwork);
  const ethers = conn.ethers;

  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error(
      `No deployer account configured for network '${targetNetwork}'. ` +
      `Ensure MST_PRIVATE_KEY is set in environment or .env file.`
    );
  }

  const [deployer] = signers;
  const networkName = conn.networkName || targetNetwork;

  console.log("\n======================================================");
  console.log("  OverVault — Smart Contract Deployment");
  console.log("======================================================");
  console.log(`  Network   : ${networkName}`);
  const netInfo = await ethers.provider.getNetwork();
  console.log(`  Chain ID  : ${netInfo.chainId}`);
  console.log(`  Deployer  : ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance   : ${ethers.formatEther(balance)} ETH`);
  console.log("======================================================\n");

  // ── 1. Ownership.sol ───────────────────────────────────────────────────────
  console.log("Deploying Ownership.sol...");
  const OwnershipFactory = await ethers.getContractFactory("Ownership");
  const ownership = await OwnershipFactory.deploy();
  await ownership.waitForDeployment();
  const ownershipAddress = await ownership.getAddress();
  const ownershipTx = ownership.deploymentTransaction()?.hash ?? "n/a";
  console.log("Ownership deployed at:");
  console.log(ownershipAddress);
  console.log(`deploy tx: ${ownershipTx}\n`);

  // ── 2. Permission.sol ──────────────────────────────────────────────────────
  console.log("Deploying Permission.sol...");
  const PermissionFactory = await ethers.getContractFactory("Permission");
  const permission = await PermissionFactory.deploy();
  await permission.waitForDeployment();
  const permissionAddress = await permission.getAddress();
  const permissionTx = permission.deploymentTransaction()?.hash ?? "n/a";
  console.log("Permission deployed at:");
  console.log(permissionAddress);
  console.log(`deploy tx: ${permissionTx}\n`);

  // ── 3. Integrity.sol ───────────────────────────────────────────────────────
  console.log("Deploying Integrity.sol...");
  const IntegrityFactory = await ethers.getContractFactory("Integrity");
  const integrity = await IntegrityFactory.deploy();
  await integrity.waitForDeployment();
  const integrityAddress = await integrity.getAddress();
  const integrityTx = integrity.deploymentTransaction()?.hash ?? "n/a";
  console.log("Integrity deployed at:");
  console.log(integrityAddress);
  console.log(`deploy tx: ${integrityTx}\n`);

  // ── 4. Audit.sol ───────────────────────────────────────────────────────────
  console.log("Deploying Audit.sol...");
  const AuditFactory = await ethers.getContractFactory("Audit");
  const audit = await AuditFactory.deploy();
  await audit.waitForDeployment();
  const auditAddress = await audit.getAddress();
  const auditTx = audit.deploymentTransaction()?.hash ?? "n/a";
  console.log("Audit deployed at:");
  console.log(auditAddress);
  console.log(`deploy tx: ${auditTx}\n`);

  // ── Deployment record ─────────────────────────────────────────────────────
  const deployedAt = new Date().toISOString();
  const record = {
    network: networkName,
    deployedAt,
    deployer: deployer.address,
    contracts: {
      Ownership: {
        address: ownershipAddress,
        deployTx: ownershipTx,
      },
      Permission: {
        address: permissionAddress,
        deployTx: permissionTx,
      },
      Integrity: {
        address: integrityAddress,
        deployTx: integrityTx,
      },
      Audit: {
        address: auditAddress,
        deployTx: auditTx,
      },
    },
  };

  const recordPath = path.join(__dirname, "..", `deployed.${networkName}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  console.log(`✓ Deployment record saved → ${recordPath}`);

  // Also update deployed.testnet.json if on testnet or mst_testnet
  const testnetRecordPath = path.join(__dirname, "..", "deployed.testnet.json");
  const testnetRecord = {
    network: networkName,
    updated: deployedAt,
    contracts: {
      ownership: {
        address: ownershipAddress,
        abi: "src/Ownership.sol/Ownership.json",
        deploy_tx: ownershipTx,
      },
      permission: {
        address: permissionAddress,
        abi: "src/Permission.sol/Permission.json",
        deploy_tx: permissionTx,
      },
      integrity: {
        address: integrityAddress,
        abi: "src/Integrity.sol/Integrity.json",
        deploy_tx: integrityTx,
      },
      audit: {
        address: auditAddress,
        abi: "src/Audit.sol/Audit.json",
        deploy_tx: auditTx,
      },
    },
  };
  fs.writeFileSync(testnetRecordPath, JSON.stringify(testnetRecord, null, 2) + "\n");
  console.log(`✓ Testnet record saved → ${testnetRecordPath}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n======================================================");
  console.log("  Deployment Summary");
  console.log("======================================================");
  console.log(`Ownership  : ${ownershipAddress}`);
  console.log(`Permission : ${permissionAddress}`);
  console.log(`Integrity  : ${integrityAddress}`);
  console.log(`Audit      : ${auditAddress}`);
  console.log("======================================================\n");

  // ── Backend Configuration block ───────────────────────────────────────────
  console.log("────────────────────────────────────────────────────");
  console.log("  Backend .env Configuration (RealChainService):");
  console.log("────────────────────────────────────────────────────");
  console.log(`EVM_RPC_URL=${process.env.MST_RPC_URL || process.env.EVM_RPC_URL || "http://127.0.0.1:8545"}`);
  console.log(`EVM_PRIVATE_KEY=${process.env.MST_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "<your-private-key>"}`);
  console.log(`CONTRACT_ADDRESS_AUDIT=${auditAddress}`);
  console.log(`CONTRACT_ADDRESS_INTEGRITY=${integrityAddress}`);
  console.log(`CONTRACT_ADDRESS_OWNERSHIP=${ownershipAddress}`);
  console.log(`CONTRACT_ADDRESS_PERMISSION=${permissionAddress}`);
  console.log("────────────────────────────────────────────────────\n");

  return {
    ownershipAddress,
    permissionAddress,
    integrityAddress,
    auditAddress,
    ownershipTx,
    permissionTx,
    integrityTx,
    auditTx,
  };
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
