/**
 * test/Permission.test.js
 *
 * Hardhat 3 + Mocha + Chai + Ethers.js tests for the Permission contract.
 *
 * Coverage:
 *   - grantPermission: successful grant, event emission, overwrite
 *   - checkPermission: valid grant → true, wrong action → false, expired → false
 *   - getPermission: raw record retrieval
 *   - revokePermission: removes record, emits event, reverts when not found
 *   - Empty argument and zero-address validation
 */

import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Permission", function () {
  let permission;
  let admin, grantee, other;
  const FILE_ID = "file-001";
  const ACTION = "READ";
  const NO_EXPIRY = 0n; // 0 means never expires

  beforeEach(async function () {
    [admin, grantee, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("Permission");
    permission = await Factory.deploy();
    await permission.waitForDeployment();
  });

  // --------------------------------------------------------------------------
  // grantPermission
  // --------------------------------------------------------------------------

  describe("grantPermission", function () {
    it("grants a permission successfully", async function () {
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, NO_EXPIRY);
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, ACTION)
      ).to.be.true;
    });

    it("emits PermissionGranted event with correct arguments", async function () {
      await expect(
        permission.grantPermission(FILE_ID, grantee.address, ACTION, NO_EXPIRY)
      )
        .to.emit(permission, "PermissionGranted")
        .withArgs(FILE_ID, grantee.address, ACTION, NO_EXPIRY, (ts) => ts > 0n);
    });

    it("allows multiple actions to be granted on the same file", async function () {
      await permission.grantPermission(FILE_ID, grantee.address, "READ", NO_EXPIRY);
      await permission.grantPermission(FILE_ID, grantee.address, "WRITE", NO_EXPIRY);
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, "READ")
      ).to.be.true;
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, "WRITE")
      ).to.be.true;
    });

    it("overwrites existing permission (re-grant with new expiry)", async function () {
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, NO_EXPIRY);
      const futureExpiry = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365);
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, futureExpiry);
      const [exists, expiry] = await permission.getPermission(
        FILE_ID, grantee.address, ACTION
      );
      expect(exists).to.be.true;
      expect(expiry).to.equal(futureExpiry);
    });

    it("rejects empty fileId", async function () {
      await expect(
        permission.grantPermission("", grantee.address, ACTION, NO_EXPIRY)
      ).to.be.revertedWithCustomError(permission, "EmptyFileId");
    });

    it("rejects empty action", async function () {
      await expect(
        permission.grantPermission(FILE_ID, grantee.address, "", NO_EXPIRY)
      ).to.be.revertedWithCustomError(permission, "EmptyAction");
    });

    it("rejects zero address as grantee", async function () {
      await expect(
        permission.grantPermission(FILE_ID, ethers.ZeroAddress, ACTION, NO_EXPIRY)
      ).to.be.revertedWithCustomError(permission, "ZeroAddress");
    });
  });

  // --------------------------------------------------------------------------
  // checkPermission
  // --------------------------------------------------------------------------

  describe("checkPermission", function () {
    it("returns true for a granted, non-expired permission", async function () {
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, NO_EXPIRY);
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, ACTION)
      ).to.be.true;
    });

    it("returns false for an address that was not granted permission", async function () {
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, NO_EXPIRY);
      expect(
        await permission.checkPermission(FILE_ID, other.address, ACTION)
      ).to.be.false;
    });

    it("returns false for an action not granted to the grantee", async function () {
      await permission.grantPermission(FILE_ID, grantee.address, "READ", NO_EXPIRY);
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, "WRITE")
      ).to.be.false;
    });

    it("returns false when permission is expired", async function () {
      // Set expiry in the past
      const pastExpiry = BigInt(Math.floor(Date.now() / 1000) - 3600);
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, pastExpiry);
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, ACTION)
      ).to.be.false;
    });

    it("returns true when permission has a future expiry", async function () {
      const futureExpiry = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365);
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, futureExpiry);
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, ACTION)
      ).to.be.true;
    });

    it("returns false for completely unknown file", async function () {
      expect(
        await permission.checkPermission("unknown-file", grantee.address, ACTION)
      ).to.be.false;
    });
  });

  // --------------------------------------------------------------------------
  // getPermission
  // --------------------------------------------------------------------------

  describe("getPermission", function () {
    it("returns exists=false for a permission that was never granted", async function () {
      const [exists] = await permission.getPermission(FILE_ID, grantee.address, ACTION);
      expect(exists).to.be.false;
    });

    it("returns correct expiry for a granted permission", async function () {
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 1000);
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, expiry);
      const [exists, storedExpiry] = await permission.getPermission(
        FILE_ID, grantee.address, ACTION
      );
      expect(exists).to.be.true;
      expect(storedExpiry).to.equal(expiry);
    });
  });

  // --------------------------------------------------------------------------
  // revokePermission
  // --------------------------------------------------------------------------

  describe("revokePermission", function () {
    beforeEach(async function () {
      await permission.grantPermission(FILE_ID, grantee.address, ACTION, NO_EXPIRY);
    });

    it("removes the permission after revoke", async function () {
      await permission.revokePermission(FILE_ID, grantee.address, ACTION);
      expect(
        await permission.checkPermission(FILE_ID, grantee.address, ACTION)
      ).to.be.false;
    });

    it("emits PermissionRevoked event", async function () {
      await expect(
        permission.revokePermission(FILE_ID, grantee.address, ACTION)
      )
        .to.emit(permission, "PermissionRevoked")
        .withArgs(FILE_ID, grantee.address, ACTION, (ts) => ts > 0n);
    });

    it("reverts when revoking a permission that does not exist", async function () {
      await expect(
        permission.revokePermission(FILE_ID, other.address, ACTION)
      ).to.be.revertedWithCustomError(permission, "PermissionNotFound");
    });
  });
});
