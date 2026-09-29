# OverVault — Running Instructions

A complete, step-by-step guide to setting up, running, and verifying the integrated **OverVault** full-stack system (FastAPI backend + Next.js frontend + BridgeKey wallet).

---

## 🛠️ Prerequisites

Before starting, ensure your machine has:
- **Node.js**: v18.0.0 or later (Node 20+ recommended)
- **Python**: v3.11 or v3.12 (Python 3.12+ recommended)
- **Browser**: Google Chrome, Brave, or Edge (with [BridgeKey Wallet](https://chrome.google.com/webstore) extension installed if testing real wallet signatures)

---

## ⚙️ Step 1: Environment Configuration

### Frontend Configuration
The frontend uses `frontend/.env.local` to direct API traffic to the live FastAPI backend and enable the BridgeKey wallet adapter:

```bash
# Ensure frontend/.env.local exists with the following content:
```
File: `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_MODE=real
NEXT_PUBLIC_WALLET_MODE=bridgekey
NEXT_PUBLIC_MSTSCAN_BASE_URL=https://mstscan.io
```

### Backend Configuration (Optional / Defaults)
The backend runs with sensible defaults out of the box (`AUTH_MODE=dev`, `CHAIN_MODE=fake`, SQLite database `overvault.db`). If you wish to customize port or secrets, copy `.env.example` to `backend/.env`.

---

## 🚀 Step 2: Start the Backend (FastAPI)

1. Open a new terminal window / PowerShell and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. *(Recommended)* Activate your Python virtual environment if you use one:
   ```bash
   # Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements-dev.txt
   ```

4. Verify backend health by running the unit & integration test suite:
   ```bash
   pytest -v
   ```
   *(Expected output: 47 passed in ~3s)*

5. Launch the FastAPI development server on port **8000**:
   ```bash
   uvicorn app.main:create_app --factory --reload --port 8000
   ```

6. **Verify Backend is Running:**
   - Open your browser or run: `http://localhost:8000/docs`
   - You should see the interactive Swagger OpenAPI UI.

---

## 💻 Step 3: Start the Frontend (Next.js)

1. Open a **second** terminal window and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install npm dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

4. **Verify Frontend is Running:**
   - The terminal will display: `ready - started server on 0.0.0.0:3000, url: http://localhost:3000`
   - Open your browser and navigate to: **`http://localhost:3000/login`**

---

## 🔐 Step 4: Authentication & Verification

When you visit `http://localhost:3000`:
- **Unauthenticated Users:** You will automatically be routed to the **`/login`** page.

### Option A: Log in via BridgeKey Wallet
1. On the `/login` page, stay on the **Wallet Signature** tab.
2. Click **BridgeKey Wallet**.
   - If the BridgeKey browser extension is installed, it requests account access.
   - If testing in an environment without the extension, it securely falls back to seeded testnet account `0xaaa1`.
3. Click **Sign Challenge & Enter**.
4. The system requests an EIP-191 challenge nonce from `POST /api/auth/nonce`, generates a cryptographic signature, exchanges it for a JWT at `POST /api/auth/wallet-login`, and unlocks the vault.

### Option B: Log in via Dev Personas (Instant Role Testing)
Click the **Dev Personas** tab to log in with pre-configured RBAC roles:

| Persona | Name | Role | Testnet Wallet | Primary Capability |
| :--- | :--- | :--- | :--- | :--- |
| **`u1`** | **Asha Rao** | `employee` | `0xaaa1` | Upload documents, request file access, view active files |
| **`u2`** | **Ravi Kumar** | `manager` | `0xbbb2` | Review and approve/reject document modification requests |
| **`u3`** | **Meera Iyer** | `admin` | `0xccc3` | Manage storage nodes, configure replication policy |
| **`u4`** | **Kiran Shah** | `auditor` | `0xddd4` | View immutable audit trail & inspect blockchain proof hashes |

---

## 🔍 Step 5: Verify Live Dynamic Data on the Dashboard

Once logged in, verify that the application is operating dynamically:
1. **Topbar Profile & Wallet:**
   - Look at the top-right header:
     - Logged in as **Asha Rao** &rarr; Shows pill **`0xaaa1`** and avatar badge **`AR`**.
     - Logged in as **Ravi Kumar** &rarr; Shows pill **`0xbbb2`** and avatar badge **`RK`**.
     - Logged in as **Meera Iyer** &rarr; Shows pill **`0xccc3`** and avatar badge **`MI`**.
     - Logged in as **Kiran Shah** &rarr; Shows pill **`0xddd4`** and avatar badge **`KS`**.
2. **Dashboard Integrity Card:**
   - The summary card displays: `Blockchain Status: connected (fake chain - dev)`.
3. **File Upload & Audit Log:**
   - Upload a test file on the **My Files** page &rarr; it uploads via `multipart/form-data`, computes the SHA-256 hash, and generates an audit record viewable on the **Audit Trail** page.

---

## ❓ Troubleshooting

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| **Old mock data appears** | Stale Service Worker cached in browser | Hard-refresh the page (`Ctrl + Shift + R` or `Cmd + Shift + R`). The app automatically unregisters `mockServiceWorker.js` on startup when `NEXT_PUBLIC_API_MODE=real`. |
| **Port 8000 already in use** | Another instance of uvicorn is running | In PowerShell, run: `Get-Process python \| Stop-Process -Force`, then restart uvicorn. |
| **Port 3000 already in use** | Next.js defaults to 3001 | Either kill the old Node process or access the frontend at `http://localhost:3001`. |
| **401 Unauthorized errors in console** | Session token expired or cleared | Visit `http://localhost:3000/login` and log in again with any persona. |
| **TypeScript / Build check** | Pre-commit sanity check | In `frontend/`, run `npx tsc --noEmit` (should report 0 errors). |

---

## 📜 Summary of Ports & URLs
- **Frontend App:** `http://localhost:3000` (or `http://localhost:3001`)
- **Login Page:** `http://localhost:3000/login`
- **Dashboard:** `http://localhost:3000/dashboard`
- **Backend API:** `http://localhost:8000/api`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`
