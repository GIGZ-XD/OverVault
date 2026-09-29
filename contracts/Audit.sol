// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Audit
 * @notice Append-only, immutable audit log for OverVault.
 *
 * Every application action (file upload, approval, download, share, etc.) is
 * recorded permanently on-chain.  Entries are append-only — no update or
 * delete functions exist.
 *
 * Architecture:
 *   Backend → ChainService → RealChainService → Audit.logAudit()
 */
contract Audit {
    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /**
     * @dev A single audit log entry.
     */
    struct AuditEntry {
        string eventType;   // e.g. "FILE_UPLOADED", "FILE_APPROVED"
        string referenceId; // Application file/entity identifier
        string actor;       // User or service that performed the action
        uint256 timestamp;  // block.timestamp at log time
    }

    /// @dev All audit entries, in append order.
    AuditEntry[] private _entries;

    /// @dev referenceId => list of indices into _entries for that referenceId.
    mapping(string => uint256[]) private _entriesByRef;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted when a new audit entry is logged.
     * @param index       Index of the entry in the global entries array.
     * @param eventType   Application event type string.
     * @param referenceId Application file/entity identifier.
     * @param actor       User or service that performed the action.
     * @param timestamp   Block timestamp at the time of logging.
     */
    event AuditLogged(
        uint256 indexed index,
        string eventType,
        string indexed referenceId,
        string actor,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @dev Raised when any required string argument is empty.
    error EmptyArgument(string argName);

    // -------------------------------------------------------------------------
    // Public functions
    // -------------------------------------------------------------------------

    /**
     * @notice Record an audit event on-chain.
     *
     * Requirements:
     * - `eventType` must not be empty.
     * - `referenceId` must not be empty.
     * - `actor` must not be empty.
     *
     * Entries are appended and cannot be modified.
     *
     * @param eventType   Application-level event type (e.g. "FILE_UPLOADED").
     * @param referenceId File or entity identifier this event relates to.
     * @param actor       Identity of the user or service that triggered the event.
     */
    function logAudit(
        string calldata eventType,
        string calldata referenceId,
        string calldata actor
    ) external {
        if (bytes(eventType).length == 0) revert EmptyArgument("eventType");
        if (bytes(referenceId).length == 0) revert EmptyArgument("referenceId");
        if (bytes(actor).length == 0) revert EmptyArgument("actor");

        uint256 index = _entries.length;

        // Append the new entry
        _entries.push(AuditEntry({
            eventType: eventType,
            referenceId: referenceId,
            actor: actor,
            timestamp: block.timestamp
        }));

        // Index this entry under the referenceId for efficient retrieval
        _entriesByRef[referenceId].push(index);

        emit AuditLogged(index, eventType, referenceId, actor, block.timestamp);
    }

    /**
     * @notice Retrieve a single audit entry by its global index.
     *
     * @param index Global index of the entry.
     * @return eventType   Event type string.
     * @return referenceId Reference identifier.
     * @return actor       Actor that triggered the event.
     * @return timestamp   Block timestamp when the event was logged.
     */
    function getEntry(uint256 index)
        external
        view
        returns (
            string memory eventType,
            string memory referenceId,
            string memory actor,
            uint256 timestamp
        )
    {
        require(index < _entries.length, "Audit: index out of bounds");
        AuditEntry storage e = _entries[index];
        return (e.eventType, e.referenceId, e.actor, e.timestamp);
    }

    /**
     * @notice Retrieve all audit entry indices for a given referenceId.
     *
     * @param referenceId The file/entity identifier to query.
     * @return            Array of global entry indices.
     */
    function getEntriesForRef(string calldata referenceId)
        external
        view
        returns (uint256[] memory)
    {
        return _entriesByRef[referenceId];
    }

    /**
     * @notice Total number of audit entries recorded globally.
     *
     * @return Count of all entries.
     */
    function totalEntries() external view returns (uint256) {
        return _entries.length;
    }
}
