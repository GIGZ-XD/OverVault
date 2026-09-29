import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Phase 5: Smart Contract Security Validation", function () {
  let audit, integrity, ownership, permission;
  let owner, alice, bob, attacker;
  const ZERO_ADDRESS = ethers.ZeroAddress;

  beforeEach(async function () {
    [owner, alice, bob, attacker] = await ethers.getSigners();

    const AuditFactory = await ethers.getContractFactory("Audit");
    audit = await AuditFactory.deploy();
    await audit.waitForDeployment();

    const IntegrityFactory = await ethers.getContractFactory("Integrity");
    integrity = await IntegrityFactory.deploy();
    await integrity.waitForDeployment();

    const OwnershipFactory = await ethers.getContractFactory("Ownership");
    ownership = await OwnershipFactory.deploy();
    await ownership.waitForDeployment();

    const PermissionFactory = await ethers.getContractFactory("Permission");
    permission = await PermissionFactory.deploy();
    await permission.waitForDeployment();
  });

  describe("Access Control & Authorization Rules", function () {
    it("prevents non-owners from transferring ownership", async function () {
      const fileId = "secure-file-001";
      await ownership.connect(alice).registerOwnership(fileId, alice.address);

      // Attacker attempts to transfer ownership of Alice's file to Bob
      await expect(
        ownership.connect(attacker).transferOwnership(fileId, bob.address)
      )
        .to.be.revertedWithCustomError(ownership, "NotOwner")
        .withArgs(fileId, attacker.address);

      // Verify owner is still Alice
      expect(await ownership.getOwner(fileId)).to.equal(alice.address);
    });

    it("prevents ownership transfer to zero address", async function () {
      const fileId = "secure-file-002";
      await ownership.connect(alice).registerOwnership(fileId, alice.address);

      await expect(
        ownership.connect(alice).transferOwnership(fileId, ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(ownership, "ZeroAddress");
    });

    it("prevents duplicate registration of the same fileId", async function () {
      const fileId = "secure-file-003";
      await ownership.connect(alice).registerOwnership(fileId, alice.address);

      await expect(
        ownership.connect(bob).registerOwnership(fileId, bob.address)
      )
        .to.be.revertedWithCustomError(ownership, "OwnershipAlreadyRegistered")
        .withArgs(fileId);
    });
  });

  describe("Data Integrity & Hash Immutability", function () {
    it("guarantees committed content hashes cannot be modified for a version", async function () {
      const fileId = "immutable-doc-1";
      const version = 1;
      const originalHash = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const tamperedHash = "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

      // Commit initial hash
      await integrity.commitHash(fileId, version, originalHash);
      expect(await integrity.verifyHash(fileId, version, originalHash)).to.be.true;

      // Attacker attempts to overwrite the committed version
      await expect(
        integrity.commitHash(fileId, version, tamperedHash)
      )
        .to.be.revertedWithCustomError(integrity, "VersionAlreadyCommitted")
        .withArgs(fileId, version);

      // Verify original hash remains untouched
      expect(await integrity.verifyHash(fileId, version, originalHash)).to.be.true;
      expect(await integrity.verifyHash(fileId, version, tamperedHash)).to.be.false;
    });

    it("rejects empty fileId or empty contentHash in integrity commitments", async function () {
      await expect(
        integrity.commitHash("", 1, "sha256:validhash")
      )
        .to.be.revertedWithCustomError(integrity, "EmptyArgument")
        .withArgs("fileId");

      await expect(
        integrity.commitHash("file-1", 1, "")
      )
        .to.be.revertedWithCustomError(integrity, "EmptyArgument")
        .withArgs("contentHash");
    });
  });

  describe("Permission Expiry & Revocation Security", function () {
    it("enforces timestamp-based expiry strictly", async function () {
      const fileId = "timebound-file-1";
      const block = await ethers.provider.getBlock("latest");
      const pastExpiry = block.timestamp - 100; // expired 100s ago

      await permission.grantPermission(fileId, bob.address, "read", pastExpiry);

      // checkPermission must return false for expired grants
      expect(await permission.checkPermission(fileId, bob.address, "read")).to.be.false;
    });

    it("prevents revoking nonexistent permissions", async function () {
      await expect(
        permission.revokePermission("nonexistent-file", bob.address, "write")
      )
        .to.be.revertedWithCustomError(permission, "PermissionNotFound")
        .withArgs("nonexistent-file", bob.address, "write");
    });

    it("rejects zero address as grantee", async function () {
      await expect(
        permission.grantPermission("file-1", ZERO_ADDRESS, "read", 0)
      ).to.be.revertedWithCustomError(permission, "ZeroAddress");
    });
  });

  describe("Audit Trail Append-Only Security", function () {
    it("ensures entries are monotonically appended and reject empty fields", async function () {
      await expect(
        audit.logAudit("", "ref-1", "user-1")
      )
        .to.be.revertedWithCustomError(audit, "EmptyArgument")
        .withArgs("eventType");

      await expect(
        audit.logAudit("UPLOAD", "", "user-1")
      )
        .to.be.revertedWithCustomError(audit, "EmptyArgument")
        .withArgs("referenceId");

      await expect(
        audit.logAudit("UPLOAD", "ref-1", "")
      )
        .to.be.revertedWithCustomError(audit, "EmptyArgument")
        .withArgs("actor");

      const tx = await audit.logAudit("FILE_UPLOADED", "ref-100", "alice");
      await expect(tx)
        .to.emit(audit, "AuditLogged")
        .withArgs(0, "FILE_UPLOADED", "ref-100", "alice", (ts) => ts > 0n);
    });
  });
});
