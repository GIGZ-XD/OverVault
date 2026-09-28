# OverVault — Apple Design System (DESIGN.md)

Frontend design language adapted from the Apple Human Interface design spec (`temp/SKILL.md` from `getdesign.md/apple`) for Next.js + Tailwind CSS.

---

## 1. The 8 Non-Negotiable Rules

1. **One accent, ever.** Every interactive element — links, primary CTAs, active states, focus — is **Action Blue `#0066cc`** (`var(--primary)`). On dark surfaces, it's Sky-link blue `#2997ff`. Semantic colors (danger, success, warning) exist only for status, never for style.
2. **Pill CTAs.** All primary buttons and search inputs are full pills (`rounded-full` / `radius.pill`). The pill radius *is* the "this is an action" signal.
3. **No chrome shadows.** Never put a shadow on a card, button, sheet, dialog, or text. Elevation comes from surface-color change (light canvas ↔ parchment ↔ dark tile) and 1px hairlines.
4. **Weight ladder = 400 / 600 / 700. 500 is banned.** Body is 400 (`regular`), emphasis/labels are 600 (`semiBold`), headlines are 700 (`bold`). Never use medium / 500.
5. **Hairlines, not borders.** Separators are 1px in `hairline` (`#e0e0e0`) or `dividerSoft` (`#f0f0f0`). No heavy 2px+ borders except 2px `primaryFocus` (`#0071e3`) for a selected card or active input.
6. **Continuous corners (Apple Radii Scale):**
   - `sm`: 6px (`rounded-[6px]`)
   - `md`: 10px (`rounded-[10px]`)
   - `lg`: 14px (`rounded-[14px]`) — cards, dialogs, sheets
   - `xl`: 20px (`rounded-[20px]`) — large hero surfaces
   - `pill`: 9999px (`rounded-full`) — CTAs, search inputs, chips
7. **Air is the pedestal.** Generous whitespace around content; lists and cards never touch the screen edge.
8. **Alerts & modals follow Apple:** Scrim backdrop (`rgba(0,0,0,0.45)`), 14px radius, 1px hairlines, no shadows.

---

## 2. Design Tokens

### Color Palette

| Token | Light Value | Dark Value | Role |
|---|---|---|---|
| `primary` | `#0066cc` | `#2997ff` | **Action Blue.** The only interactive accent. |
| `primaryFocus` | `#0071e3` | `#0071e3` | 2px selected item border & focus ring |
| `canvas` | `#ffffff` | `#1c1c1e` | Dominant surface |
| `canvasParchment` | `#f5f5f7` | `#272729` | Signature Apple off-white tile & pressed surface |
| `hairline` | `#e0e0e0` | `#38383a` | 1px border/separator |
| `dividerSoft` | `#f0f0f0` | `#2c2c2e` | Soft row divider |
| `ink` | `#1d1d1f` | `#ffffff` | Primary text |
| `inkMuted80` | `#333333` | `#e5e5e7` | Secondary text |
| `inkMuted48` | `#7a7a7a` | `#8e8e93` | Captions, placeholders, disabled text |
| `success` | `#34c759` | `#30d158` | Verified on-chain, status only |
| `warning` | `#ff9500` | `#ffd60a` | Pending approval / unconfirmed |
| `danger` | `#ff3b30` | `#ff453a` | Tampered, revoked, errors |
| `scrim` | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.65)` | Modal / sheet backdrop |

---

## 3. Motion & Transitions

- Press response: `active:scale-[0.95]` for pill buttons; `active:scale-[0.98]` for cards.
- Entrances: 180–220ms ease-out cubic, no bouncy chrome.
