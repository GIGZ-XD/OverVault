// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Integrity
 * @notice Stores and verifies document content hashes on-chain.
 *
 * Each (fileId, version) pair maps to exactly one content hash.
 * Once committed, a hash is immutable — re-committing the same version
 * is rejected to prevent tampering.
 *
 * The latest committed version number for each fileId is also tracked,
 * so callers can retrieve the most recent hash without off-chain state.
 *
 * Architecture:
 *   Backend → ChainService → RealChainService → Integrity.commitHash()
 *                                              → Integrity.verifyHash()
 */
contract Integrity {
    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @dev fileId => version => contentHash (SHA-256 or IPFS CID as string)
    mapping(string => mapping(uint256 => string)) private _hashes;

    /// @dev fileId => whether a given version has been committed
    mapping(string => mapping(uint256 => bool)) private _committed;

    /// @dev fileId => latest committed version number
    mapping(string => uint256) private _latestVersion;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted when a new content hash is committed for a document version.
     * @param fileId      Application-level file identifier.
     * @param version     Document version number.
     * @param contentHash SHA-256 or IPFS CID of the document content.
     * @param timestamp   Block timestamp at the time of commitment.
     */
    event HashCommitted(
        string indexed fileId,
        uint256 version,
        string contentHash,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @dev Raised when attempting to commit a version that already exists.
    error VersionAlreadyCommitted(string fileId, uint256 version);

    /// @dev Raised when any string argument is empty.
    error EmptyArgument(string argName);

    // -------------------------------------------------------------------------
    // Public functions
    // -------------------------------------------------------------------------

    /**
     * @notice Commit a content hash for a specific file version.
     *
     * Requirements:
     * - `fileId` must not be empty.
     * - `contentHash` must not be empty.
     * - This (fileId, version) pair must not have been committed before.
     *
     * @param fileId      Application-level file identifier.
     * @param version     Document version number (1-indexed recommended).
     * @param contentHash SHA-256 hex string or IPFS CID of the file content.
     */
    function commitHash(
        string calldata fileId,
        uint256 version,
        string calldata contentHash
    ) external {
        if (bytes(fileId).length == 0) revert EmptyArgument("fileId");
        if (bytes(contentHash).length == 0) revert EmptyArgument("contentHash");
        if (_committed[fileId][version]) {
            revert VersionAlreadyCommitted(fileId, version);
        }

        // Persist hash and mark version as committed
        _hashes[fileId][version] = contentHash;
        _committed[fileId][version] = true;

        // Update latest version pointer if this version is newer
        if (version > _latestVersion[fileId]) {
            _latestVersion[fileId] = version;
        }

        emit HashCommitted(fileId, version, contentHash, block.timestamp);
    }

    /**
     * @notice Verify whether the given hash matches what was committed for
     *         (fileId, version).
     *
     * @param fileId      Application-level file identifier.
     * @param version     Document version number.
     * @param contentHash Hash to verify against the committed record.
     * @return            True if the hash matches; false otherwise.
     */
    function verifyHash(
        string calldata fileId,
        uint256 version,
        string calldata contentHash
    ) external view returns (bool) {
        if (!_committed[fileId][version]) {
            return false;
        }
        // Compare the stored hash with the provided hash using keccak256
        return keccak256(bytes(_hashes[fileId][version])) == keccak256(bytes(contentHash));
    }

    /**
     * @notice Retrieve the raw committed hash for a (fileId, version) pair.
     *
     * @param fileId  Application-level file identifier.
     * @param version Document version number.
     * @return        The committed content hash, or empty string if not found.
     */
    function getHash(
        string calldata fileId,
        uint256 version
    ) external view returns (string memory) {
        return _hashes[fileId][version];
    }

    /**
     * @notice Retrieve the latest committed version number for a file.
     *
     * @param fileId Application-level file identifier.
     * @return       The latest version number (0 if no version committed).
     */
    function getLatestVersion(
        string calldata fileId
    ) external view returns (uint256) {
        return _latestVersion[fileId];
    }

    /**
     * @notice Check whether a (fileId, version) pair has been committed.
     *
     * @param fileId  Application-level file identifier.
     * @param version Document version number.
     * @return        True if the version has been committed.
     */
    function isCommitted(
        string calldata fileId,
        uint256 version
    ) external view returns (bool) {
        return _committed[fileId][version];
    }
}
