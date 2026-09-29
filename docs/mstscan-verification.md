# MSTScan Verification Walkthrough & Blockchain Evidence

## MST Testnet Configuration

| Parameter | Confirmed Value |
|---|---|
| **Network Name** | MST EVM Testnet |
| **JSON-RPC Endpoint** | `https://testnetrpc.mstblockchain.com` |
| **Chain ID** | `91562037` (`0x5752035`) |
| **Block Explorer** | [https://testnet.mstscan.com](https://testnet.mstscan.com) |
| **Deployer Wallet** | `0x8D980974EFc134749E397178359e9356052F5409` |
| **Currency Symbol** | MST ($tMSTC) |

---

## Deployed Smart Contracts

All four OverVault smart contracts are compiled with Solidity `0.8.20` and deployed on the live MST Testnet.

| Contract | Address | Deployment Tx Hash | MSTScan Link |
|---|---|---|---|
| **Audit.sol** | `0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb` | `0x31270b0c50c99aae0dd726fedf48d200103e5100760a2d525b5d43b8363d35b1` | [Audit on MSTScan](https://testnet.mstscan.com/address/0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb) |
| **Integrity.sol** | `0x5e724C47DCEccC41902f2D129091faf6D1D833AB` | `0x4af02ab8e2dc508def65b308b630c6c032ca5fb6bc220f92562d5d17e9d1fd8f` | [Integrity on MSTScan](https://testnet.mstscan.com/address/0x5e724C47DCEccC41902f2D129091faf6D1D833AB) |
| **Ownership.sol** | `0x53017dd1A227a7Fcf7665C59B7E3360995dCB148` | `0x75bdf0d0cc6960bf8cfef6c8efd6dbddf4f7800ca54582902c82f2275e83a3b7` | [Ownership on MSTScan](https://testnet.mstscan.com/address/0x53017dd1A227a7Fcf7665C59B7E3360995dCB148) |
| **Permission.sol** | `0x6BC2c8B4B373F4a5c3E6Fef36F2E7BA427292b1E` | `0x89aac4f4dce6634928bf02018f3aa54c68d355f97e128839437f901f33352907` | [Permission on MSTScan](https://testnet.mstscan.com/address/0x6BC2c8B4B373F4a5c3E6Fef36F2E7BA427292b1E) |

---

## Live On-Chain Transaction Evidence

The following transactions have been mined on MST Testnet and verified on MSTScan:

### 1. Audit Trail Event (`Audit.logAudit`)
- **Transaction Hash**: `0xea8afdcaa290847e0ce295b479420469e19b1e42cd4ffe8d39fb8bbc4889669b`
- **Block**: `5795336`
- **Contract**: `0x98686687390Bb44D9B8d240A19Ca9b7c26071Fdb` (Audit)
- **Status**: Success (`0x1`)
- **Event**: `AuditLogged`
  - `eventType`: `"MST_DEPLOY_VERIFY"`
  - `actor`: `"sriganesh-blockchain-engineer"`
  - `timestamp`: `1790641267`
- **MSTScan Link**: [0xea8afdcaa290847e0ce295b479420469e19b1e42cd4ffe8d39fb8bbc4889669b](https://testnet.mstscan.com/tx/0xea8afdcaa290847e0ce295b479420469e19b1e42cd4ffe8d39fb8bbc4889669b)
- **What It Proves**: An append-only audit event was logged on the blockchain with caller metadata and timestamp. The file content remains completely private off-chain; only the reference ID and event type are recorded.

### 2. Document Cryptographic Hash Anchor (`Integrity.commitHash`)
- **Transaction Hash**: `0xb620b78eddea792f2d71d4609fbc0cce3f00f163f182d50e7c1f1de34dbd1722`
- **Block**: `5795337`
- **Contract**: `0x5e724C47DCEccC41902f2D129091faf6D1D833AB` (Integrity)
- **Status**: Success (`0x1`)
- **Event**: `HashCommitted`
  - `version`: `1`
  - `contentHash`: `"sha256-mst-d100b399d215421180d4c4e63f364f5c"`
  - `timestamp`: `1790641270`
- **MSTScan Link**: [0xb620b78eddea792f2d71d4609fbc0cce3f00f163f182d50e7c1f1de34dbd1722](https://testnet.mstscan.com/tx/0xb620b78eddea792f2d71d4609fbc0cce3f00f163f182d50e7c1f1de34dbd1722)
- **What It Proves**: Demonstrates that version 1 of a document was committed to the blockchain with its exact SHA-256 digest. Any party can independently verify file integrity using `Integrity.verifyHash()` without needing access to the document contents.

### 3. File Ownership Registration (`Ownership.registerOwnership`)
- **Transaction Hash**: `0x385674f1d8293b9975330d260090907caa27c5f2d05051c9bf4da43491a591c5`
- **Block**: `5795340`
- **Status**: Success (`0x1`)
- **MSTScan Link**: [0x385674f1d8293b9975330d260090907caa27c5f2d05051c9bf4da43491a591c5](https://testnet.mstscan.com/tx/0x385674f1d8293b9975330d260090907caa27c5f2d05051c9bf4da43491a591c5)
- **What It Proves**: Binds the document file identifier to the creator's wallet address and anchors the initial version hash at genesis.

---

## Verifying an Audit Event in OverVault

1. Navigate to `/audit` in the web application.
2. In the audit table, locate the event row.
3. The **Transaction** column renders a `TxLink` component showing the truncated hash with an external link icon.
4. Click the transaction chip to open the transaction directly on `https://testnet.mstscan.com/tx/<txHash>`.
5. On MSTScan:
   - Verify **Status**: `Success` (`0x1`).
   - Verify **To Address**: Matches the relevant contract (e.g. `0x9868...1Fdb` for Audit).
   - In the transaction logs / input parameters, verify that only the SHA-256 digest and reference identifiers are stored.
   - Raw document bytes and customer secrets are never present on-chain.
