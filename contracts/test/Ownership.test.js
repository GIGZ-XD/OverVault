/**
 * test/Ownership.test.js
 *
 * Hardhat 3 + Mocha + Chai + Ethers.js tests for the Ownership contract.
 *
 * Coverage:
 *   - registerOwnership: successful registration, event emission
 *   - getOwner: retrieves owner; returns zero address for unregistered
 *   - isRegistered: reflects registration state
 *   - Duplicate registration rejected
 *   - transferOwnership: owner-only, event emission
 *   - Empty argument and zero-address validation
 */

import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Ownership", function () {
  let ownership;
  let owner, other;
  const FILE_ID = "file-001";

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("Ownership");
    ownership = await Factory.deploy();
    await ownership.waitForDeployment();
  });

  // --------------------------------------------------------------------------
  // registerOwnership
  // --------------------------------------------------------------------------

  describe("registerOwnership", function () {
    it("registers the owner for a fileId", async function () {
      await ownership.registerOwnership(FILE_ID, owner.address);
      expect(await ownership.getOwner(FILE_ID)).to.equal(owner.address);
    });

    it("emits OwnershipRegistered event with correct arguments", async function () {
      await expect(ownership.registerOwnership(FILE_ID, owner.address))
        .to.emit(ownership, "OwnershipRegistered")
        .withArgs(FILE_ID, owner.address, (ts) => ts > 0n);
    });

    it("marks the fileId as registered", async function () {
      await ownership.registerOwnership(FILE_ID, owner.address);
      expect(await ownership.isRegistered(FILE_ID)).to.be.true;
    });

    it("rejects duplicate registration for the same fileId", async function () {
      await ownership.registerOwnership(FILE_ID, owner.address);
      await expect(
        ownership.registerOwnership(FILE_ID, other.address)
      )
        .to.be.revertedWithCustomError(ownership, "OwnershipAlreadyRegistered")
        .withArgs(FILE_ID);
    });

    it("rejects empty fileId", async function () {
      await expect(ownership.registerOwnership("", owner.address))
        .to.be.revertedWithCustomError(ownership, "EmptyFileId");
    });

    it("rejects zero address as owner", async function () {
      await expect(
        ownership.registerOwnership(FILE_ID, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ownership, "ZeroAddress");
    });
  });

  // --------------------------------------------------------------------------
  // getOwner
  // --------------------------------------------------------------------------

  describe("getOwner", function () {
    it("returns the registered owner address", async function () {
      await ownership.registerOwnership(FILE_ID, owner.address);
      expect(await ownership.getOwner(FILE_ID)).to.equal(owner.address);
    });

    it("returns zero address for an unregistered fileId", async function () {
      expect(await ownership.getOwner("unregistered-file")).to.equal(
        ethers.ZeroAddress
      );
    });
  });

  // --------------------------------------------------------------------------
  // isRegistered
  // --------------------------------------------------------------------------

  describe("isRegistered", function () {
    it("returns false before registration", async function () {
      expect(await ownership.isRegistered("new-file")).to.be.false;
    });

    it("returns true after registration", async function () {
      await ownership.registerOwnership(FILE_ID, owner.address);
      expect(await ownership.isRegistered(FILE_ID)).to.be.true;
    });
  });

  // --------------------------------------------------------------------------
  // transferOwnership
  // --------------------------------------------------------------------------

  describe("transferOwnership", function () {
    beforeEach(async function () {
      await ownership.registerOwnership(FILE_ID, owner.address);
    });

    it("allows the current owner to transfer ownership", async function () {
      await ownership.connect(owner).transferOwnership(FILE_ID, other.address);
      expect(await ownership.getOwner(FILE_ID)).to.equal(other.address);
    });

    it("emits OwnershipTransferred event", async function () {
      await expect(
        ownership.connect(owner).transferOwnership(FILE_ID, other.address)
      )
        .to.emit(ownership, "OwnershipTransferred")
        .withArgs(FILE_ID, owner.address, other.address, (ts) => ts > 0n);
    });

    it("rejects transfer from a non-owner", async function () {
      await expect(
        ownership.connect(other).transferOwnership(FILE_ID, other.address)
      )
        .to.be.revertedWithCustomError(ownership, "NotOwner")
        .withArgs(FILE_ID, other.address);
    });

    it("rejects transfer to zero address", async function () {
      await expect(
        ownership.connect(owner).transferOwnership(FILE_ID, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ownership, "ZeroAddress");
    });
  });
});
