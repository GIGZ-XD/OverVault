/**
 * test/Audit.test.js
 *
 * Hardhat 3 + Mocha + Chai + Ethers.js tests for the Audit contract.
 *
 * Coverage:
 *   - logAudit: successful logging, event emission, multiple entries
 *   - getEntry: retrieves stored entry by index
 *   - getEntriesForRef: returns correct indices per referenceId
 *   - totalEntries: reflects running count
 *   - Empty argument validation
 *   - Append-only: entries cannot be overwritten
 */

import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Audit", function () {
  let audit;
  const EVENT_TYPE = "FILE_UPLOADED";
  const REF_ID = "file-001";
  const ACTOR = "user-42";

  beforeEach(async function () {
    const Factory = await ethers.getContractFactory("Audit");
    audit = await Factory.deploy();
    await audit.waitForDeployment();
  });

  // --------------------------------------------------------------------------
  // logAudit
  // --------------------------------------------------------------------------

  describe("logAudit", function () {
    it("creates an audit entry successfully", async function () {
      await audit.logAudit(EVENT_TYPE, REF_ID, ACTOR);
      expect(await audit.totalEntries()).to.equal(1n);
    });

    it("emits AuditLogged event with correct arguments", async function () {
      await expect(audit.logAudit(EVENT_TYPE, REF_ID, ACTOR))
        .to.emit(audit, "AuditLogged")
        .withArgs(0n, EVENT_TYPE, REF_ID, ACTOR, (ts) => ts > 0n);
    });

    it("increments entry count with each call", async function () {
      await audit.logAudit("FILE_UPLOADED", REF_ID, ACTOR);
      await audit.logAudit("FILE_APPROVED", REF_ID, "reviewer-1");
      await audit.logAudit("FILE_DOWNLOADED", REF_ID, ACTOR);
      expect(await audit.totalEntries()).to.equal(3n);
    });

    it("rejects empty eventType", async function () {
      await expect(audit.logAudit("", REF_ID, ACTOR))
        .to.be.revertedWithCustomError(audit, "EmptyArgument")
        .withArgs("eventType");
    });

    it("rejects empty referenceId", async function () {
      await expect(audit.logAudit(EVENT_TYPE, "", ACTOR))
        .to.be.revertedWithCustomError(audit, "EmptyArgument")
        .withArgs("referenceId");
    });

    it("rejects empty actor", async function () {
      await expect(audit.logAudit(EVENT_TYPE, REF_ID, ""))
        .to.be.revertedWithCustomError(audit, "EmptyArgument")
        .withArgs("actor");
    });
  });

  // --------------------------------------------------------------------------
  // getEntry
  // --------------------------------------------------------------------------

  describe("getEntry", function () {
    beforeEach(async function () {
      await audit.logAudit(EVENT_TYPE, REF_ID, ACTOR);
    });

    it("retrieves the correct eventType", async function () {
      const [eventType] = await audit.getEntry(0n);
      expect(eventType).to.equal(EVENT_TYPE);
    });

    it("retrieves the correct referenceId", async function () {
      const [, referenceId] = await audit.getEntry(0n);
      expect(referenceId).to.equal(REF_ID);
    });

    it("retrieves the correct actor", async function () {
      const [, , actor] = await audit.getEntry(0n);
      expect(actor).to.equal(ACTOR);
    });

    it("retrieves a non-zero timestamp", async function () {
      const [, , , timestamp] = await audit.getEntry(0n);
      expect(timestamp).to.be.greaterThan(0n);
    });

    it("reverts when index is out of bounds", async function () {
      await expect(audit.getEntry(99n)).to.be.revertedWith(
        "Audit: index out of bounds"
      );
    });
  });

  // --------------------------------------------------------------------------
  // getEntriesForRef
  // --------------------------------------------------------------------------

  describe("getEntriesForRef", function () {
    it("returns an empty array for a fileId with no entries", async function () {
      const indices = await audit.getEntriesForRef("unknown-file");
      expect(indices.length).to.equal(0);
    });

    it("returns correct indices for a single referenceId", async function () {
      await audit.logAudit(EVENT_TYPE, "file-A", ACTOR);        // index 0
      await audit.logAudit("FILE_APPROVED", "file-A", "r1");   // index 1
      const indices = await audit.getEntriesForRef("file-A");
      expect(indices.map(Number)).to.deep.equal([0, 1]);
    });

    it("does not mix entries across different referenceIds", async function () {
      await audit.logAudit(EVENT_TYPE, "file-A", ACTOR);   // index 0
      await audit.logAudit(EVENT_TYPE, "file-B", ACTOR);   // index 1

      const indicesA = await audit.getEntriesForRef("file-A");
      const indicesB = await audit.getEntriesForRef("file-B");
      expect(indicesA.map(Number)).to.deep.equal([0]);
      expect(indicesB.map(Number)).to.deep.equal([1]);
    });
  });

  // --------------------------------------------------------------------------
  // Append-only integrity
  // --------------------------------------------------------------------------

  describe("Append-only integrity", function () {
    it("entries cannot be overwritten — each call creates a new entry", async function () {
      await audit.logAudit("EVT_A", REF_ID, "user-1");
      await audit.logAudit("EVT_B", REF_ID, "user-2");

      const [type0] = await audit.getEntry(0n);
      const [type1] = await audit.getEntry(1n);

      expect(type0).to.equal("EVT_A");
      expect(type1).to.equal("EVT_B");
      expect(await audit.totalEntries()).to.equal(2n);
    });
  });
});
