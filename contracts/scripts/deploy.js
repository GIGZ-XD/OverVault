/**
 * deploy.js — OverVault Smart Contract Deployment Script (Hardhat 3)
 *
 * Deploys all four OverVault contracts:
 *   - Integrity   : Document content hash anchoring
 *   - Audit        : Append-only audit log
 *   - Ownership    : File ownership registry
 *   - Permission   : Access permission management
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js
 *   npx hardhat run scripts/deploy.js --network mst_testnet
 *
 * Deployed addresses are printed to stdout and can be wired into
 * RealChainService (backend/app/chain/real.py) environment variables.
 */

import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("\n======================================================");
  console.log("  OverVault — Smart Contract Deployment");
  console.log("======================================================");
  console.log(`  Network   : ${hre.network.name}`);
  console.log(`  Deployer  : ${deployer.address}`);
  console.log("======================================================\n");

  // ── 1. Integrity ─────────────────────────────────────────────────────────
  console.log("Deploying Integrity...");
  const IntegrityFactory = await hre.ethers.getContractFactory("Integrity");
  const integrity = await IntegrityFactory.deploy();
  await integrity.waitForDeployment();
  const integrityAddress = await integrity.getAddress();
  console.log(`  ✓ Integrity   deployed at: ${integrityAddress}`);

  // ── 2. Audit ──────────────────────────────────────────────────────────────
  console.log("Deploying Audit...");
  const AuditFactory = await hre.ethers.getContractFactory("Audit");
  const audit = await AuditFactory.deploy();
  await audit.waitForDeployment();
  const auditAddress = await audit.getAddress();
  console.log(`  ✓ Audit       deployed at: ${auditAddress}`);

  // ── 3. Ownership ──────────────────────────────────────────────────────────
  console.log("Deploying Ownership...");
  const OwnershipFactory = await hre.ethers.getContractFactory("Ownership");
  const ownership = await OwnershipFactory.deploy();
  await ownership.waitForDeployment();
  const ownershipAddress = await ownership.getAddress();
  console.log(`  ✓ Ownership   deployed at: ${ownershipAddress}`);

  // ── 4. Permission ─────────────────────────────────────────────────────────
  console.log("Deploying Permission...");
  const PermissionFactory = await hre.ethers.getContractFactory("Permission");
  const permission = await PermissionFactory.deploy();
  await permission.waitForDeployment();
  const permissionAddress = await permission.getAddress();
  console.log(`  ✓ Permission  deployed at: ${permissionAddress}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n======================================================");
  console.log("  Deployment Summary");
  console.log("======================================================");
  const summary = {
    network: hre.network.name,
    contracts: {
      Integrity: integrityAddress,
      Audit: auditAddress,
      Ownership: ownershipAddress,
      Permission: permissionAddress,
    },
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log("======================================================\n");

  // ── Environment variable hints for RealChainService ──────────────────────
  console.log("Add these to backend/.env for RealChainService:");
  console.log(`  INTEGRITY_CONTRACT_ADDRESS=${integrityAddress}`);
  console.log(`  AUDIT_CONTRACT_ADDRESS=${auditAddress}`);
  console.log(`  OWNERSHIP_CONTRACT_ADDRESS=${ownershipAddress}`);
  console.log(`  PERMISSION_CONTRACT_ADDRESS=${permissionAddress}`);
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
