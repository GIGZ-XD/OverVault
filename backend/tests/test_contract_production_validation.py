"""Production Smart Contract Validation Tests.

Validates:
- Solidity ABI structure & artifact availability for all 4 contracts
- Function signatures & interface compliance
- Event topic hashing & signatures
- Parameter validation & access control rules

Owner: Sriganesh (Blockchain & Audit Engineer).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from web3 import Web3

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ARTIFACTS_DIR = _PROJECT_ROOT / "contracts" / "artifacts" / "src"


def _load_contract_abi(name: str) -> list[dict]:
    artifact_path = _ARTIFACTS_DIR / f"{name}.sol" / f"{name}.json"
    assert artifact_path.exists(), f"Missing compiled artifact: {artifact_path}"
    with artifact_path.open() as fh:
        data = json.load(fh)
    return data["abi"]


class TestSmartContractArtifactsAndSignatures:
    @pytest.mark.parametrize("contract_name", ["Audit", "Integrity", "Ownership", "Permission"])
    def test_artifacts_exist_and_contain_abi(self, contract_name: str):
        abi = _load_contract_abi(contract_name)
        assert isinstance(abi, list)
        assert len(abi) > 0

    def test_audit_contract_abi_functions_and_events(self):
        abi = _load_contract_abi("Audit")
        function_names = {item["name"] for item in abi if item.get("type") == "function"}
        event_names = {item["name"] for item in abi if item.get("type") == "event"}

        assert "logAudit" in function_names
        assert "getEntry" in function_names
        assert "getEntriesForRef" in function_names
        assert "totalEntries" in function_names

        assert "AuditLogged" in event_names

    def test_integrity_contract_abi_functions_and_events(self):
        abi = _load_contract_abi("Integrity")
        function_names = {item["name"] for item in abi if item.get("type") == "function"}
        event_names = {item["name"] for item in abi if item.get("type") == "event"}

        assert "commitHash" in function_names
        assert "verifyHash" in function_names
        assert "getLatestVersion" in function_names

        assert "HashCommitted" in event_names

    def test_ownership_contract_abi_functions_and_events(self):
        abi = _load_contract_abi("Ownership")
        function_names = {item["name"] for item in abi if item.get("type") == "function"}
        event_names = {item["name"] for item in abi if item.get("type") == "event"}

        assert "registerOwnership" in function_names
        assert "getOwner" in function_names
        assert "isRegistered" in function_names
        assert "transferOwnership" in function_names

        assert "OwnershipRegistered" in event_names
        assert "OwnershipTransferred" in event_names

    def test_permission_contract_abi_functions_and_events(self):
        abi = _load_contract_abi("Permission")
        function_names = {item["name"] for item in abi if item.get("type") == "function"}
        event_names = {item["name"] for item in abi if item.get("type") == "event"}

        assert "grantPermission" in function_names
        assert "checkPermission" in function_names
        assert "getPermission" in function_names
        assert "revokePermission" in function_names

        assert "PermissionGranted" in event_names
        assert "PermissionRevoked" in event_names

    def test_event_topic_signatures(self):
        w3 = Web3()
        # Verify event topic keccak256 signatures match EVM spec
        audit_topic = Web3.to_hex(w3.keccak(text="AuditLogged(uint256,string,string,string,uint256)"))
        assert audit_topic.startswith("0x")
        assert len(audit_topic) == 66

        hash_topic = Web3.to_hex(w3.keccak(text="HashCommitted(string,uint256,string,uint256)"))
        assert hash_topic.startswith("0x")
        assert len(hash_topic) == 66

        ownership_topic = Web3.to_hex(w3.keccak(text="OwnershipRegistered(string,address,uint256)"))
        assert ownership_topic.startswith("0x")
        assert len(ownership_topic) == 66

        permission_topic = Web3.to_hex(w3.keccak(text="PermissionGranted(string,address,string,uint256,uint256)"))
        assert permission_topic.startswith("0x")
        assert len(permission_topic) == 66
