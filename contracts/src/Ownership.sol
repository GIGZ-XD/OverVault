// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Ownership
 * @notice On-chain file ownership registry for OverVault.
 *
 * Maps each fileId to a single Ethereum address owner.
 * Ownership can be transferred by the current owner.
 *
 * Architecture:
 *   Backend → ChainService → RealChainService → Ownership.registerOwnership()
 *                                              → Ownership.getOwner()
 */
contract Ownership {
    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @dev fileId => owner address
    mapping(string => address) private _owners;

    /// @dev fileId => whether ownership has been registered at least once
    mapping(string => bool) private _registered;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted when ownership is registered for a file.
     * @param fileId    Application-level file identifier.
     * @param owner     Address of the new owner.
     * @param timestamp Block timestamp at registration time.
     */
    event OwnershipRegistered(
        string indexed fileId,
        address indexed owner,
        uint256 timestamp
    );

    /**
     * @notice Emitted when ownership is transferred.
     * @param fileId      Application-level file identifier.
     * @param previousOwner Previous owner address.
     * @param newOwner    New owner address.
     * @param timestamp   Block timestamp at transfer time.
     */
    event OwnershipTransferred(
        string indexed fileId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @dev Raised when fileId is empty.
    error EmptyFileId();

    /// @dev Raised when the provided owner address is the zero address.
    error ZeroAddress();

    /// @dev Raised when trying to register a fileId that already has an owner.
    error OwnershipAlreadyRegistered(string fileId);

    /// @dev Raised when a non-owner calls a restricted function.
    error NotOwner(string fileId, address caller);

    // -------------------------------------------------------------------------
    // Public functions
    // -------------------------------------------------------------------------

    /**
     * @notice Register initial ownership of a file.
     *
     * Requirements:
     * - `fileId` must not be empty.
     * - `owner` must not be the zero address.
     * - No ownership must have been previously registered for `fileId`.
     *
     * @param fileId Application-level file identifier.
     * @param owner  Address to set as the file owner.
     */
    function registerOwnership(
        string calldata fileId,
        address owner
    ) external {
        if (bytes(fileId).length == 0) revert EmptyFileId();
        if (owner == address(0)) revert ZeroAddress();
        if (_registered[fileId]) revert OwnershipAlreadyRegistered(fileId);

        _owners[fileId] = owner;
        _registered[fileId] = true;

        emit OwnershipRegistered(fileId, owner, block.timestamp);
    }

    /**
     * @notice Transfer ownership of a file to a new owner.
     *
     * Only the current owner can transfer ownership.
     *
     * @param fileId   Application-level file identifier.
     * @param newOwner Address to transfer ownership to.
     */
    function transferOwnership(
        string calldata fileId,
        address newOwner
    ) external {
        if (bytes(fileId).length == 0) revert EmptyFileId();
        if (newOwner == address(0)) revert ZeroAddress();
        if (_owners[fileId] != msg.sender) revert NotOwner(fileId, msg.sender);

        address previous = _owners[fileId];
        _owners[fileId] = newOwner;

        emit OwnershipTransferred(fileId, previous, newOwner, block.timestamp);
    }

    /**
     * @notice Get the owner address for a file.
     *
     * @param fileId Application-level file identifier.
     * @return       Owner address, or zero address if not registered.
     */
    function getOwner(string calldata fileId)
        external
        view
        returns (address)
    {
        return _owners[fileId];
    }

    /**
     * @notice Check whether ownership has been registered for a fileId.
     *
     * @param fileId Application-level file identifier.
     * @return       True if ownership has been registered.
     */
    function isRegistered(string calldata fileId)
        external
        view
        returns (bool)
    {
        return _registered[fileId];
    }
}
