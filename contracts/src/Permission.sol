// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Permission
 * @notice On-chain access-permission registry for OverVault.
 *
 * Tracks which addresses have been granted which actions on which files,
 * and optionally until what block timestamp (expiry = 0 means no expiry).
 *
 * Architecture:
 *   Backend → ChainService → RealChainService → Permission.grantPermission()
 *                                              → Permission.checkPermission()
 */
contract Permission {
    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /**
     * @dev A single permission record.
     */
    struct PermissionRecord {
        string  action;     // e.g. "READ", "WRITE", "APPROVE"
        uint256 expiry;     // Unix timestamp; 0 = never expires
        bool    exists;     // set to true when the record is created
    }

    /**
     * @dev fileId => grantee address => action => PermissionRecord
     *
     * Multiple actions can be granted to the same grantee on the same file.
     */
    mapping(string => mapping(address => mapping(string => PermissionRecord)))
        private _permissions;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted when a permission is granted.
     * @param fileId    Application-level file identifier.
     * @param grantee   Address receiving the permission.
     * @param action    Action being granted (e.g. "READ", "WRITE").
     * @param expiry    Expiry timestamp (0 = never expires).
     * @param timestamp Block timestamp at grant time.
     */
    event PermissionGranted(
        string indexed fileId,
        address indexed grantee,
        string action,
        uint256 expiry,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a permission is explicitly revoked.
     * @param fileId    Application-level file identifier.
     * @param grantee   Address whose permission was revoked.
     * @param action    Action that was revoked.
     * @param timestamp Block timestamp at revoke time.
     */
    event PermissionRevoked(
        string indexed fileId,
        address indexed grantee,
        string action,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @dev Raised when fileId is empty.
    error EmptyFileId();

    /// @dev Raised when action is empty.
    error EmptyAction();

    /// @dev Raised when grantee is the zero address.
    error ZeroAddress();

    /// @dev Raised when revoking a permission that does not exist.
    error PermissionNotFound(string fileId, address grantee, string action);

    // -------------------------------------------------------------------------
    // Public functions
    // -------------------------------------------------------------------------

    /**
     * @notice Grant a permission for a specific action on a file to a grantee.
     *
     * If a permission record already exists for this (fileId, grantee, action)
     * combination it is overwritten (i.e. the expiry can be extended or tightened).
     *
     * @param fileId  Application-level file identifier.
     * @param grantee Address receiving the permission.
     * @param action  Action being permitted (e.g. "READ", "WRITE", "APPROVE").
     * @param expiry  Unix timestamp after which the permission expires; 0 = no expiry.
     */
    function grantPermission(
        string calldata fileId,
        address grantee,
        string calldata action,
        uint256 expiry
    ) external {
        if (bytes(fileId).length == 0) revert EmptyFileId();
        if (grantee == address(0)) revert ZeroAddress();
        if (bytes(action).length == 0) revert EmptyAction();

        _permissions[fileId][grantee][action] = PermissionRecord({
            action: action,
            expiry: expiry,
            exists: true
        });

        emit PermissionGranted(fileId, grantee, action, expiry, block.timestamp);
    }

    /**
     * @notice Check whether a grantee currently holds a valid, non-expired
     *         permission for a given action on a file.
     *
     * @param fileId  Application-level file identifier.
     * @param grantee Address to check.
     * @param action  Action to check.
     * @return        True if the permission exists and has not expired.
     */
    function checkPermission(
        string calldata fileId,
        address grantee,
        string calldata action
    ) external view returns (bool) {
        PermissionRecord storage record = _permissions[fileId][grantee][action];

        if (!record.exists) {
            return false;
        }

        // expiry == 0 means the permission never expires
        if (record.expiry != 0 && block.timestamp > record.expiry) {
            return false;
        }

        return true;
    }

    /**
     * @notice Retrieve the raw permission record for a (fileId, grantee, action).
     *
     * @param fileId  Application-level file identifier.
     * @param grantee Address to query.
     * @param action  Action to query.
     * @return exists True if a record exists.
     * @return expiry Expiry timestamp (0 = no expiry).
     */
    function getPermission(
        string calldata fileId,
        address grantee,
        string calldata action
    ) external view returns (bool exists, uint256 expiry) {
        PermissionRecord storage record = _permissions[fileId][grantee][action];
        return (record.exists, record.expiry);
    }

    /**
     * @notice Revoke a previously granted permission.
     *
     * Reverts if the permission record does not exist.
     *
     * @param fileId  Application-level file identifier.
     * @param grantee Address whose permission is to be revoked.
     * @param action  Action to revoke.
     */
    function revokePermission(
        string calldata fileId,
        address grantee,
        string calldata action
    ) external {
        if (!_permissions[fileId][grantee][action].exists) {
            revert PermissionNotFound(fileId, grantee, action);
        }

        delete _permissions[fileId][grantee][action];

        emit PermissionRevoked(fileId, grantee, action, block.timestamp);
    }
}
