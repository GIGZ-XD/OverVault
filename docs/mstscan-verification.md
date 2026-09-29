# MSTScan Verification Walkthrough

**Purpose:** How to verify an OverVault document's integrity proof on MSTScan (MST Blockchain Explorer).

---

## What is MSTScan?

MSTScan (`https://mstscan.io`) is the block explorer for MST Blockchain (testnet). It allows anyone to independently verify that a document's SHA-256 hash was committed on-chain at a specific time by a specific wallet address.

## Step 1: Find the Transaction Hash

Every verified document in OverVault has a **Transaction Hash** (tx hash) linking it to the blockchain.

**Where to find it:**
- **File Detail Drawer** → Overview tab → "MST Transaction" field
- **Audit Trail** → Tx Hash column on any verified event
- **Format:** `0xtx1a8b3e29f0cc21e...` (truncated with copy button)

## Step 2: Open on MSTScan

1. Click the **external link icon** (↗) next to any tx hash in OverVault
2. This opens: `https://mstscan.io/tx/{tx_hash}`
3. Alternatively, copy the hash and paste it into MSTScan's search bar

## Step 3: Verify the Transaction Details

On the MSTScan transaction page, verify:

| Field | What to check |
|---|---|
| **Status** | Should show ✅ `Success` |
| **Block** | Confirms the block number where the proof was mined |
| **Timestamp** | Matches the time shown in OverVault's audit trail |
| **From** | The wallet address that signed the transaction (backend signer or user) |
| **To** | The OverVault smart contract address |
| **Input Data** | Contains the SHA-256 hash of the document (decoded) |

## Step 4: Verify the Hash Matches

1. In OverVault, go to the file's **Detail Drawer** → copy the SHA-256 hash
2. On MSTScan, expand the **Input Data** section
3. Decode the input data — the document hash should be present in the calldata
4. **If they match:** The document's integrity is independently verified
5. **If they don't match:** The document may have been tampered with after the on-chain commitment

## Step 5: Verify an Audit Proof

For audit events (access grants, revocations, protection changes):

1. Navigate to OverVault's **Audit Trail** page
2. Filter by the event type you want to verify
3. Click the tx hash on the specific event row
4. On MSTScan, the transaction input data will contain:
   - Event type identifier
   - Affected file's hash reference
   - Actor's wallet address
   - Timestamp of the action

## Common Scenarios

### Document Upload Verification
- **Event:** `ownership_register`
- **On-chain data:** SHA-256 hash + owner wallet + file ID reference
- **Proves:** This file existed in this exact form at this timestamp

### Access Grant Verification
- **Event:** `access_grant`
- **On-chain data:** Grantee address + permission level + expiry
- **Proves:** Access was explicitly authorized and signed

### Integrity Re-verification
- **Event:** `hash_verification`
- **On-chain data:** Computed hash vs stored hash comparison
- **Proves:** File content has not been altered since the original commitment

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Tx hash shows "Not Found" | Chain confirmation still pending | Wait 30s and refresh; check outbox worker status |
| Hash mismatch | File modified after chain commit | Re-upload or investigate in audit trail |
| "Wrong Network" | Wallet connected to mainnet | Switch to MST Testnet (Chain ID: 98214) |

---

> **Note:** In the current v1 demo, `CHAIN_MODE=fake` is used in development. Transaction hashes are simulated. In testnet/mainnet mode, all hashes are real on-chain commitments.
