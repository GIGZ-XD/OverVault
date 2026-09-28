# OverVault — DESIGN.md (Frontend Design System)

Stack: Next.js (React) + Tailwind CSS. This file is the source of truth for the UI. Anyone (or any AI agent) building a screen should follow it.

## 1. Design principles

1. **Trust first.** This is a security product. The UI should feel calm, precise and dependable, never flashy.
2. **Show proof, not promises.** Every important action shows its verification state (hash, tx, MSTScan link).
3. **Blockchain stays in the background.** Users see "Verified" and "Pending", with raw hashes available on demand.
4. **Dense but readable.** Enterprise users scan tables all day. Prioritize clarity over decoration.
5. **Never block on the chain.** Storage actions complete instantly; on-chain confirmation updates asynchronously.

## 2. Visual style

Modern, clean, slightly technical. Dark-first with a full light theme. Soft surfaces, thin borders, one accent color, generous spacing, subtle motion.

## 3. Design tokens

### Color (CSS variables)

```css
:root {
  /* Light theme */
  --bg:            #F7F8FA;
  --surface:       #FFFFFF;
  --surface-2:     #F0F2F5;
  --border:        #E2E5EA;
  --text:          #101828;
  --text-muted:    #667085;
  --accent:        #4F46E5;   /* indigo, primary actions */
  --accent-hover:  #4338CA;
  --accent-soft:   #EEF0FF;
  --success:       #12B76A;   /* verified */
  --warning:       #F79009;   /* pending */
  --danger:        #F04438;   /* tampered / revoked */
  --info:          #2E90FA;
}

[data-theme="dark"] {
  --bg:            #0B0F17;
  --surface:       #121826;
  --surface-2:     #1A2233;
  --border:        #26304A;
  --text:          #E7EAF3;
  --text-muted:    #8B95AD;
  --accent:        #7C83FF;
  --accent-hover:  #9AA0FF;
  --accent-soft:   #1C2140;
  --success:       #32D583;
  --warning:       #FDB022;
  --danger:        #F97066;
  --info:          #53B1FD;
}
```

**Status semantics (never change these):**
| State | Color | Meaning |
|---|---|---|
| Verified | success | Hash matches on-chain record |
| Pending | warning | Chain write queued or unconfirmed |
| Tampered / Mismatch | danger | Hash does not match on-chain record |
| Revoked / Expired | text-muted | Access no longer active |

### Typography
- **UI font:** Inter (fallback `system-ui, sans-serif`)
- **Mono font (hashes, addresses, tx ids):** JetBrains Mono (fallback `ui-monospace`)

| Style | Size / Line | Weight |
|---|---|---|
| Display | 32 / 40 | 700 |
| H1 | 24 / 32 | 600 |
| H2 | 18 / 28 | 600 |
| Body | 14 / 22 | 400 |
| Small / caption | 12 / 18 | 500 |
| Mono | 13 / 20 | 500 |

### Spacing, radius, elevation
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px (Tailwind default scale)
- Radius: `sm 6px` (inputs, chips), `md 10px` (cards, buttons), `lg 16px` (modals)
- Shadow: light theme uses a soft `0 1px 2px rgba(16,24,40,.06)`; dark theme uses borders only, no shadows.

### Motion
- 150 to 200 ms ease-out for hovers and toggles; 250 ms for modals and drawers.
- Pending state uses a subtle pulse. Respect `prefers-reduced-motion`.

## 4. Tailwind config sketch

```js
// tailwind.config.js
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
        border: 'var(--border)', text: 'var(--text)', muted: 'var(--text-muted)',
        accent: 'var(--accent)', 'accent-soft': 'var(--accent-soft)',
        success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '16px' },
    },
  },
};
```

## 5. Layout

- **App shell:** left sidebar (240 px, collapsible to 64 px) + top bar + content area (max width 1280 px).
- **Sidebar items:** Dashboard, My Files, Shared with me, Approvals, Audit Trail, Access Control (admin), Settings.
- **Top bar:** global search, wallet chip (address, network badge "MST Testnet"), theme toggle, user menu.
- **Breakpoints:** desktop-first; tablet (≥768 px) collapses the sidebar; mobile view is read-only friendly but not a v1 target.

## 6. Core components

| Component | Notes |
|---|---|
| **Button** | Primary (accent fill), Secondary (surface + border), Ghost, Danger. 36 px height, 10 px radius. Loading state shows a spinner and keeps its width. |
| **Input / Select / Date picker** | 40 px height, visible focus ring in accent, inline error text under field. |
| **Card** | Surface background, 1 px border, 16 to 24 px padding. |
| **Data table** | Sticky header, row hover, sortable columns, bulk-select checkboxes, empty state, skeleton loading. |
| **Status badge** | Pill with dot + label: Verified, Pending, Tampered, Expired, Revoked. |
| **Hash chip** | Mono text truncated as `0x9f3a…c21e`, copy icon, tooltip with full value. |
| **Tx link** | Chip with external-link icon, opens the transaction on MSTScan in a new tab. |
| **Wallet chip** | Truncated address, network badge, dropdown with Disconnect. |
| **Permission pill** | Read / Write / Append / Admin, plus optional expiry countdown. |
| **Timeline** | Vertical list for version history and audit events, each with actor, time, and verification badge. |
| **Diff viewer** | Side-by-side version comparison for the approval screen. |
| **Modal / Drawer** | Drawer (right side) for details, modal for confirmations and signing. |
| **Toast** | Bottom-right; success, error, and "waiting for wallet signature". |
| **Empty state** | Icon + one-line explanation + primary action. |

## 7. Key screens

### 7.1 Login / Connect Wallet
- Centered card with logo, tagline, and a large **Connect BridgeKey Wallet** button.
- States: wallet not installed (link to install), connecting, awaiting signature, rejected, wrong network.
- Secondary "Sign in with email" only while the Phase 1 auth scaffold exists.

### 7.2 Dashboard
- Summary cards: storage used vs quota, files, pending approvals, verified vs pending on-chain records.
- Recent activity list and an "integrity health" widget (percentage of files whose hash is verified).

### 7.3 File Explorer (My Files)
- Table/grid toggle, breadcrumb, upload dropzone.
- Columns: Name, Owner, Size, Modified, Protection (none/read-only/append-only), Verification badge.
- Row actions: Open, Share, Versions, Protect, Verify now, Delete.

### 7.4 File Detail Drawer
- Tabs: Overview (hash chip, owner address, ownership tx link), Versions, Access, Audit.
- **Verify now** button re-hashes and compares against on-chain commitment; result shows as a badge with a short explanation.

### 7.5 Version History
- Timeline with author, timestamp, hash chip, and per-version verification badge; actions: Compare, Roll back (requires confirmation and a wallet signature).

### 7.6 Access Control
- Grant dialog: pick user or wallet address, permission, expiry date. Active grants table with countdowns and a Revoke action.
- Revocations and grants show "Signing…", then "Pending on-chain", then "Verified".

### 7.7 Approvals
- Inbox for managers: submitted changes with the diff viewer, comment box, and Approve / Reject buttons. Approve triggers a wallet signature modal.

### 7.8 Audit Trail
- Filterable table (actor, action, file, date range, verification state) with a MSTScan link on every row and Export CSV.
- Auditor role sees this as the primary landing page.

## 8. The wallet signing pattern

Every state-changing blockchain action follows the same three-step UI so users learn it once:

1. **Confirm modal** — plain-language summary ("Grant Ganesh read access until 30 Oct").
2. **Signing state** — "Check your BridgeKey wallet…" with a cancel option and timeout message.
3. **Result** — toast plus badge moves to *Pending* and later *Verified*, with the MSTScan link.

Handle: user rejected, wrong network, insufficient $MSTC (link to the faucet on testnet), timeout, and backend chain-queue failure (retry button).

## 9. Content and microcopy
- Plain words: "Verified on chain", not "Merkle commitment confirmed".
- Errors say what happened and what to do next.
- Destructive actions name the object: "Revoke access for Ganesh?".
- Use sentence case for all UI text.

## 10. Accessibility
- WCAG AA contrast for text and status colors in both themes.
- Never rely on color alone; badges always include an icon and label.
- Full keyboard navigation, visible focus rings, `aria-live` for toasts and signing state.
- Tables have proper headers; modals trap focus.

## 11. Frontend conventions
- Folder layout: `components/ui` (primitives), `components/features` (file, access, approval, audit), `app/(routes)`, `lib/api` (typed client from the OpenAPI spec), `lib/wallet` (BridgeKey helpers).
- Use the typed API client and mock with MSW until the backend is ready.
- Data fetching with TanStack Query; loading, empty and error states are required for every list.
- No raw hex colors in components; use tokens only.
- Icons: Lucide.

## 12. Definition of done for a screen
- [ ] Matches tokens and components above (both themes)
- [ ] Loading, empty, error, and pending-chain states handled
- [ ] Verification badge and MSTScan link where applicable
- [ ] Keyboard accessible, contrast checked
- [ ] Works at 1280 px and 768 px widths
