/**
 * test/Integrity.test.js
 *
 * Hardhat 3 + Mocha + Chai + Ethers.js tests for the Integrity contract.
 *
 * Hardhat 3 pattern: each describe block creates its own isolated network
 * via `network.create()` (top-level await in ESM).
 *
 * Coverage:
 *   - commitHash: successful commit, event emission
 *   - verifyHash: correct hash → true, wrong hash → false, uncommitted → false
 *   - getHash: retrieves stored hash
 *   - getLatestVersion: tracks latest version pointer
 *   - isCommitted: reflects committed state
 *   - Duplicate commit rejected
 *   - Empty argument validation
 */

import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Integrity", function () {
  let integrity;
  const FILE_ID = "file-001";
  const VERSION = 1n;
  const HASH = "sha256:abc123def456";

  beforeEach(async function () {
    const Factory = await ethers.getContractFactory("Integrity");
    integrity = await Factory.deploy();
    await integrity.waitForDeployment();
  });

  // --------------------------------------------------------------------------
  // commitHash
  // --------------------------------------------------------------------------

  describe("commitHash", function () {
    it("stores the hash for a given fileId and version", async function () {
      await integrity.commitHash(FILE_ID, VERSION, HASH);
      const stored = await integrity.getHash(FILE_ID, VERSION);
      expect(stored).to.equal(HASH);
    });

    it("emits HashCommitted event with correct arguments", async function () {
      await expect(integrity.commitHash(FILE_ID, VERSION, HASH))
        .to.emit(integrity, "HashCommitted")
        .withArgs(FILE_ID, VERSION, HASH, (ts) => ts > 0n);
    });

    it("marks the version as committed", async function () {
      await integrity.commitHash(FILE_ID, VERSION, HASH);
      expect(await integrity.isCommitted(FILE_ID, VERSION)).to.be.true;
    });

    it("updates the latest version pointer", async function () {
      await integrity.commitHash(FILE_ID, 1n, HASH);
      await integrity.commitHash(FILE_ID, 3n, "sha256:newer");
      expect(await integrity.getLatestVersion(FILE_ID)).to.equal(3n);
    });

    it("does NOT update latest version if new version is lower", async function () {
      await integrity.commitHash(FILE_ID, 5n, "sha256:v5");
      await integrity.commitHash(FILE_ID, 2n, "sha256:v2");
      expect(await integrity.getLatestVersion(FILE_ID)).to.equal(5n);
    });

    it("rejects duplicate commit for the same fileId+version", async function () {
      await integrity.commitHash(FILE_ID, VERSION, HASH);
      await expect(integrity.commitHash(FILE_ID, VERSION, "sha256:different"))
        .to.be.revertedWithCustomError(integrity, "VersionAlreadyCommitted")
        .withArgs(FILE_ID, VERSION);
    });

    it("rejects empty fileId", async function () {
      await expect(integrity.commitHash("", VERSION, HASH))
        .to.be.revertedWithCustomError(integrity, "EmptyArgument")
        .withArgs("fileId");
    });

    it("rejects empty contentHash", async function () {
      await expect(integrity.commitHash(FILE_ID, VERSION, ""))
        .to.be.revertedWithCustomError(integrity, "EmptyArgument")
        .withArgs("contentHash");
    });
  });

  // --------------------------------------------------------------------------
  // verifyHash
  // --------------------------------------------------------------------------

  describe("verifyHash", function () {
    beforeEach(async function () {
      await integrity.commitHash(FILE_ID, VERSION, HASH);
    });

    it("returns true when the hash matches the committed value", async function () {
      expect(await integrity.verifyHash(FILE_ID, VERSION, HASH)).to.be.true;
    });

    it("returns false when the hash does not match", async function () {
      expect(await integrity.verifyHash(FILE_ID, VERSION, "sha256:WRONG")).to.be.false;
    });

    it("returns false for a version that was never committed", async function () {
      expect(await integrity.verifyHash(FILE_ID, 99n, HASH)).to.be.false;
    });

    it("returns false for an unknown fileId", async function () {
      expect(await integrity.verifyHash("file-unknown", VERSION, HASH)).to.be.false;
    });
  });

  // --------------------------------------------------------------------------
  // getLatestVersion
  // --------------------------------------------------------------------------

  describe("getLatestVersion", function () {
    it("returns 0 before any version is committed", async function () {
      expect(await integrity.getLatestVersion("never-touched")).to.equal(0n);
    });

    it("returns the highest committed version", async function () {
      await integrity.commitHash(FILE_ID, 2n, "sha256:v2");
      await integrity.commitHash(FILE_ID, 5n, "sha256:v5");
      expect(await integrity.getLatestVersion(FILE_ID)).to.equal(5n);
    });
  });
});
