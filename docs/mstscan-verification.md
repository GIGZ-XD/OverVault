# MSTScan Verification Walkthrough

## MST Testnet Configuration

| Parameter | Value |
|---|---|
| **Network Name** | MST Testnet |
| **RPC URL** | Configured via `MST_RPC_URL` (e.g. `https://testnet-rpc.mst.example`) |
| **Chain ID** | `91562037` (`0x5752035`) |
| **Currency Symbol** | MST |
| **Block Explorer** | Configured via `NEXT_PUBLIC_MSTSCAN_BASE_URL` |

---

## Verifying an Audit Event on MSTScan

Every file upload, version rollback, and approval decision generates an immutable cryptographic proof on the MST blockchain.

### Step 1: Locate the Transaction Hash in OverVault
1. Navigate to `/audit` in the OverVault web application.
2. Find the audit row for the file event you want to inspect.
3. The **Transaction** column displays a truncated transaction hash (e.g., `0xabc1...42f1`).
4. Click the link to open the MSTScan block explorer in a new tab.

### Step 2: Confirm Transaction Status on MSTScan
On the MSTScan transaction detail page:
- **Status**: Must show `Success` / `Confirmed`.
- **Block Number**: Shows the block in which the commitment was sealed.
- **Timestamp**: Confirms when the commitment occurred.
- **From**: Matches the actor's BridgeKey wallet address.
- **To**: OverVault Registry Smart Contract address.

### Step 3: Verify the Cryptographic Proof (Input Data)
1. Scroll down to the **Input Data / Method** section of the transaction.
2. Select **View Input as UTF-8 / Decoded**.
3. Confirm the parameters match the OverVault record:
   - `fileId`: The internal OverVault UUID.
   - `contentHash`: The exact SHA-256 digest of the encrypted file content (e.g., `0x9f3a11c21e...`).
   - `version`: The version integer committed.
4. **Data Privacy Assurance**: Note that the raw document content is NOT present anywhere on the explorer — only the 32-byte digest is anchored on-chain.

---

> [!NOTE]
> In local development / mock mode (`CHAIN_MODE=fake`), mock transaction hashes (`0xmocktx_...`) are generated deterministically. For live hackathon judges, configure `MST_RPC_URL` and `OVERVAULT_CONTRACT_ADDRESS` to point to the live MST Testnet deployment.
