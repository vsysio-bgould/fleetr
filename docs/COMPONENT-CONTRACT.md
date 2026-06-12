# Fleetr Component Contract (v1)

This document defines the **approved UI component contract** for the Fleetr web interface.

The purpose of this contract is to ensure that all generated UI remains:

- visually consistent
- aligned with the EVE Online aesthetic
- easy to maintain
- compatible with Tailwind CSS v4 and Next.js App Router

This component contract is the **only approved vocabulary** for building UI.

Do not invent new component patterns unless explicitly requested.

---

# Technology Stack

- **React 19** with TypeScript
- **Next.js App Router** for routing and server components
- **TanStack Query** for REST data fetching and caching
- **PartyKit** for real-time fleet state (`usePartySocket`)
- **Tailwind CSS v4** via PostCSS
- **shadcn/ui** as the primitive source; all primitives are overridden to match this design system

Source lives in `src/`. Next.js builds to `.next/`.

---

# Core Paradigm

## Two Layout Models

Fleetr uses **different layout models** depending on role:

### FC / Leadership — AppShell Workspace

FCs and leadership need to manage multiple concerns: the live room, member roster, queue moderation, and fleet settings. Their layout uses an **AppShell workspace** — a left sidebar of icon-based app launchers, each opening an `AppWindow` in the main workspace area.

FC sidebar apps:

| Icon | App | Purpose |
|------|-----|---------|
| Play | Fleet Room | Live player + queues + `ModeBar` |
| Users | Members | Connected roster, kick controls |
| List | Queue | Full queue moderation view (both queues) |
| Gear | Settings | Fleet name, expiry, share link |

### Line Member — Single-Page Fleet Room

Line members have one thing to do: watch, listen, and vote. Their layout uses a **single-page `FleetShell`** — no sidebar, no navigation, no chrome. Player on the left, queues on the right, `FleetHeader` at the top.

### Shared context

Both layouts wrap in `FleetProvider`. All real-time state (playback, queue, mode, votes) flows from this single context regardless of which layout is active.

---

# Core Rule

When generating UI:

Always compose from **approved components**.

Allowed:

- compose from approved React components
- use approved layout patterns
- use approved Tailwind utility groupings
- maintain strict visual consistency

Disallowed:

- inventing one-off cards or wrappers
- inventing inconsistent spacing systems
- inventing new color schemes
- using decorative, marketing, or consumer-app styling
- adding top navigation bars (sidebars are approved for FC view only via `AppSidebar`)
- using large rounded corners, drop shadows, or bright gradients

---

# Tailwind Usage Rules

## General Rules

Use Tailwind CSS for styling.

Prefer:

- reusable components
- predictable utility combinations
- stable spacing and typography
- dark-mode-first layouts

Do not:

- use arbitrary values unless absolutely necessary
- use inline style objects unless explicitly required
- use random utility combinations that diverge from the design system
- use bright or decorative color palettes
- use large rounded consumer-app styling

---

## Preferred Tailwind Tokens

### Backgrounds

- `bg-[#0b0f14]` for page background
- `bg-[#121821]` for panels
- `bg-[#0f141a]` for inset surfaces (inputs, headers, player chrome)
- `bg-[#18212c]` for hover or active states

### Borders

- `border border-[#1f2a36]` for panels
- `border border-[#253140]` for inputs
- `border border-[#2b3645]` for secondary buttons

### Text

- `text-[#e6edf3]` for primary
- `text-[#9aa4b2]` for secondary
- `text-[#6b7280]` for muted

### Accents

- primary: `#3fa7ff`
- success: `#22c55e`
- warning: `#f59e0b`
- danger: `#ef4444`
- battle mode: `#ef4444` (red — hot, urgent)
- cruise mode: `#3fa7ff` (blue — calm, steady)

---

# Typography Rules

## Fonts

- Inter for default text (`font-sans`)
- Rajdhani for operational headings and mode labels (`font-display`)

## Patterns

- `uppercase tracking-[0.04em]`
- `font-medium` or `font-semibold`

## Sizes

- `text-[12px]` labels and metadata
- `text-[13px]` dense queue data
- `text-sm` body text
- `text-base` section titles
- `text-xl` fleet name / room title

---

# Spacing Rules

Use 4px scale:

- padding: `p-1` → `p-8`
- gaps: `gap-1` → `gap-6`
- stacks: `space-y-1` → `space-y-6`

No arbitrary spacing.

---

# Approved Component Set

---

## 1. AppShell

Purpose: Root layout for the FC/leadership workspace.

Structure:

- Fixed space background image (stars)
- Glass overlay (`bg-[#0b0f14]/70 backdrop-blur-sm`)
- `AppSidebar` (left, fixed width)
- Workspace area (right, fills remaining space, renders active `AppWindow`)

Tailwind: `flex min-h-screen bg-[#0b0f14] text-[#e6edf3]`

Rules:

- Only used for FC/leadership sessions. Line members never see this layout.
- `AppShell` wraps in `FleetProvider` so all AppWindows share real-time state.

File: `components/shell/AppShell.tsx`

---

## 2. AppSidebar

Purpose: Icon-based app launcher for FC navigation.

Structure:

- Vertical icon stack
- Brand mark at top
- Hover tooltips on each icon
- Active state highlights current app

Tailwind:

- Container: `flex flex-col items-center w-12 bg-[#0b0f14] border-r border-[#1f2a36] py-2 gap-2 shrink-0`
- Icon button: `w-10 h-10 flex items-center justify-center rounded text-[#9aa4b2] hover:bg-[#18212c] hover:text-[#e6edf3] transition`
- Active: `bg-[#18212c] text-[#3fa7ff]`

Rules:

- Icons only — no text labels in the sidebar itself
- Tooltip appears on hover to the right of the icon
- Navigation via Next.js `useRouter`
- Apps: Fleet Room (`/fleet/[id]`), Members (`/fleet/[id]/members`), Queue (`/fleet/[id]/queue`), Settings (`/fleet/[id]/settings`)

File: `components/shell/AppSidebar.tsx`

---

## 3. AppWindow

Purpose: Container for a single FC app instance within the workspace.

Tailwind: `rounded border border-[#1f2a36] bg-[#121821]/80 backdrop-blur-sm shadow-lg flex flex-col flex-1 min-h-0`

File: `components/shell/AppWindow.tsx`

---

## 4. AppWindowHeader

Purpose: Title bar for an AppWindow with optional right-side controls.

Tailwind:

- Container: `flex items-center justify-between h-10 px-3 border-b border-[#1f2a36] bg-[#0f141a] rounded-t shrink-0`
- Title: `uppercase tracking-[0.04em] text-sm font-medium text-[#9aa4b2] font-display`

Props: `title: string`, `children?: ReactNode` (right-side controls)

File: `components/shell/AppWindowHeader.tsx`

---

## 5. AppWindowBody

Purpose: Scrollable content area inside an AppWindow.

Tailwind: `p-4 space-y-4 overflow-auto flex-1`

Rules: Must only contain approved components.

File: `components/shell/AppWindowBody.tsx`

---

## 6. FleetShell

Purpose: Root layout for the line member fleet room (no sidebar, no workspace chrome).

Structure:

- Fixed space background image (stars)
- Glass overlay (`bg-[#0b0f14]/70 backdrop-blur-sm`)
- `FleetHeader` (top)
- Main content area: `PlayerPanel` (left/center) + `QueuePanel` (right)

Tailwind: `flex flex-col min-h-screen bg-[#0b0f14] text-[#e6edf3]`

Rules:

- Only used for line member sessions. FC/leadership use `AppShell` instead.
- Wraps in `FleetProvider`.

File: `components/shell/FleetShell.tsx`

---

## 7. FleetHeader

Purpose: Top bar identifying the fleet and showing connection/member state.

Structure:

- Left: fleet name + FC character name
- Center: `NowPlaying` (compact inline variant)
- Right: `VolumeIndicator`, `MuteToggle`, `ConnectionPill`, member count

Tailwind:

- Container: `flex items-center justify-between h-12 px-4 border-b border-[#1f2a36] bg-[#0f141a] shrink-0`
- Fleet name: `font-display font-semibold uppercase tracking-[0.04em] text-base`

Props: `fleetName: string`, `fcName: string`, `children?: ReactNode` (right-side controls)

File: `components/shell/FleetHeader.tsx`

---

## 8. ModeBar

Purpose: FC-only control row for switching fleet mode and managing playback.

Structure:

- Left: `ModeToggle`
- Center: track title + skip button
- Right: volume nudge controls

Rules:

- Only rendered when `session.role === 'fc'`
- Sends `fleet:set-mode` and `playback:seek` messages via `useFleetParty`
- Never shown to line members — not hidden with CSS, not rendered at all

Tailwind: `flex items-center justify-between h-10 px-4 border-b border-[#1f2a36] bg-[#0f141a] shrink-0`

File: `components/shell/ModeBar.tsx`

---

## 9. PlayerPanel

Purpose: Primary content area. Contains the YouTube embed and now-playing strip.

Structure:

- YouTube iframe (16:9, fills available width)
- `NowPlaying` strip below the embed

Tailwind:

- Outer: `flex flex-col flex-1 min-w-0 bg-[#0b0f14]`
- iframe wrapper: `relative w-full` with `aspect-video`

Rules:

- The iframe `src` is always `https://www.youtube.com/embed/{videoId}` — never a user-supplied string
- Playback is driven by the YouTube IFrame API, not by `src` changes
- `PlayerPanel` is a client component (`'use client'`)

File: `components/player/PlayerPanel.tsx`

---

## 10. NowPlaying

Purpose: Displays the currently playing track.

Variants:

- `full` — thumbnail (48px) + title + submitter avatar + submitter name (used inside `PlayerPanel`)
- `inline` — title only, truncated (used inside `FleetHeader`)

Tailwind (full):

- Container: `flex items-center gap-3 px-4 py-2 border-t border-[#1f2a36] bg-[#0f141a]`
- Thumbnail: `h-12 w-[85px] rounded object-cover shrink-0`
- Title: `text-sm font-medium truncate`
- Submitter line: `text-[12px] text-[#9aa4b2] flex items-center gap-1`

Props: `track: NowPlayingTrack | null`, `variant?: 'full' | 'inline'`

File: `components/player/NowPlaying.tsx`

---

## 11. QueuePanel

Purpose: Right-side panel containing the Cruise and Battle media queues.

Structure:

- `QueueTab` switcher (Cruise / Battle)
- Active `QueueList`
- `SubmitMediaForm` pinned to the bottom

Tailwind:

- Container: `flex flex-col w-80 shrink-0 border-l border-[#1f2a36] bg-[#121821]`
- Body: `flex-1 overflow-hidden flex flex-col`

File: `components/queue/QueuePanel.tsx`

---

## 12. QueueTab

Purpose: Tab switcher between Cruise Mode and Battle Mode queues.

Variants: `cruise`, `battle`

Tailwind:

- Container: `flex border-b border-[#1f2a36]`
- Tab button: `flex-1 py-2 text-[12px] font-display font-semibold uppercase tracking-[0.04em] transition`
- Active cruise: `text-[#3fa7ff] border-b-2 border-[#3fa7ff]`
- Active battle: `text-[#ef4444] border-b-2 border-[#ef4444]`
- Inactive: `text-[#6b7280] hover:text-[#9aa4b2]`

Props: `active: 'cruise' | 'battle'`, `onChange: (mode: FleetMode) => void`, `cruiseCount: number`, `battleCount: number`

File: `components/queue/QueueTab.tsx`

---

## 13. QueueList

Purpose: Scrollable list of `QueueEntry` items for one queue.

Tailwind: `flex-1 overflow-y-auto space-y-px py-1`

Rules:

- Entries are sorted by vote count descending, then submission time ascending
- Empty state: centered muted text "Queue is empty"

Props: `entries: QueueEntry[]`, `mode: FleetMode`

File: `components/queue/QueueList.tsx`

---

## 14. QueueEntry

Purpose: Single media item in a queue with vote controls.

Structure:

- Thumbnail (small, 16:9)
- Title (truncated)
- Submitter avatar + name
- `VoteButton` (right)

Tailwind:

- Outer: `flex items-center gap-2 px-3 py-2 hover:bg-[#18212c] transition`
- Thumbnail: `h-9 w-16 rounded object-cover shrink-0`
- Title: `flex-1 text-[13px] truncate`
- Submitter: `text-[12px] text-[#6b7280]`

Props: `entry: QueueEntry`, `hasVoted: boolean`, `onVote: () => void`

File: `components/queue/QueueEntry.tsx`

---

## 15. VoteButton

Purpose: Upvote control with animated count.

States: `default`, `voted` (filled, accent color)

Tailwind:

- Base: `flex flex-col items-center gap-0.5 shrink-0 px-2 py-1 rounded transition`
- Default: `text-[#6b7280] hover:text-[#3fa7ff] hover:bg-[#18212c]`
- Voted: `text-[#3fa7ff]`
- Count: `text-[11px] tabular-nums`

Rules:

- One vote per user per entry — the `hasVoted` prop controls visual state
- Clicking a voted entry does nothing (idempotent on the server)

Props: `count: number`, `voted: boolean`, `onClick: () => void`

File: `components/queue/VoteButton.tsx`

---

## 16. SubmitMediaForm

Purpose: YouTube URL input + submit button pinned to the bottom of `QueuePanel`.

Structure:

- `FormInput` for YouTube URL
- `FormSelect` for queue target (Cruise / Battle)
- `Button` (primary, "Add to Queue")

Tailwind:

- Outer: `border-t border-[#1f2a36] p-3 space-y-2 shrink-0 bg-[#0f141a]`

Rules:

- URL is validated client-side against `https://www.youtube.com/*` and `https://youtu.be/*` before submission
- On submit, sends `queue:submit` via `useFleetParty`
- Shows inline error if URL is invalid

File: `components/queue/SubmitMediaForm.tsx`

---

## 17. ModeToggle

Purpose: FC control to switch the fleet between Cruise Mode and Battle Mode.

Structure:

- Two-segment toggle: `CRUISE` / `BATTLE`
- Active segment highlights in mode color

Tailwind:

- Container: `flex rounded border border-[#2b3645] overflow-hidden`
- Segment: `px-4 py-1 text-[12px] font-display font-semibold uppercase tracking-[0.04em] transition`
- Active cruise: `bg-[#3fa7ff]/20 text-[#3fa7ff]`
- Active battle: `bg-[#ef4444]/20 text-[#ef4444]`
- Inactive: `text-[#6b7280] hover:text-[#9aa4b2] hover:bg-[#18212c]`

Props: `mode: FleetMode`, `onChange: (mode: FleetMode) => void`

Rules: Only rendered inside `ModeBar` (FC only).

File: `components/player/ModeToggle.tsx`

---

## 18. VolumeIndicator

Purpose: Shows current effective volume based on fleet mode and user mute preference.

States:

- Cruise mode, not muted: icon + `100%`
- Battle mode, not muted: icon + `25%` in `text-[#ef4444]`
- Muted: muted icon + `MUTED` in muted text

Tailwind: `flex items-center gap-1 text-[12px] text-[#9aa4b2] shrink-0`

Props: `mode: FleetMode`, `muted: boolean`

File: `components/player/VolumeIndicator.tsx`

---

## 19. MuteToggle

Purpose: User preference to auto-mute playback regardless of fleet mode.

States: active (muted) / inactive (following fleet volume)

Tailwind: Button ghost variant with icon; active state uses `text-[#f59e0b]`

Props: `muted: boolean`, `onChange: (muted: boolean) => void`

File: `components/player/MuteToggle.tsx`

---

## 20. ConnectionPill

Purpose: Shows PartyKit real-time connection state.

States: `connecting`, `live`, `reconnecting`, `disconnected`

Tailwind:

- Container: `inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]`
- connecting/reconnecting: `bg-[#f59e0b]/15 text-[#f59e0b]`
- live: `bg-[#22c55e]/15 text-[#22c55e]`
- disconnected: `bg-[#ef4444]/15 text-[#ef4444]`

File: `components/ui/ConnectionPill.tsx`

---

## 21. CharacterAvatar

Purpose: EVE Online character portrait loaded from the ESI image server.

Sizes: `sm` (24px), `md` (32px), `lg` (48px)

Rules:

- `src` is always `https://images.evetech.net/characters/{characterId}/portrait?size={px}` — never user-supplied
- Falls back to a generic silhouette on error
- Always rendered with `alt={characterName}`

Tailwind: `rounded-full shrink-0 object-cover`

Props: `characterId: number`, `characterName: string`, `size?: 'sm' | 'md' | 'lg'`

File: `components/ui/CharacterAvatar.tsx`

---

## 22. MemberRoster

Purpose: Collapsible list of connected fleet members.

Structure:

- Clickable header: "Members (N)" + chevron
- Body: list of `CharacterAvatar` + name rows, FC marked with a badge

Tailwind:

- Outer: `border-t border-[#1f2a36]`
- Header: `flex items-center justify-between px-4 py-2 hover:bg-[#18212c] transition cursor-pointer`
- Body: `px-4 py-2 space-y-1.5`
- Member row: `flex items-center gap-2 text-[13px]`

Props: `members: FleetMember[]`

File: `components/fleet/MemberRoster.tsx`

---

## 23. Panel

Purpose: Primary surface container for supplementary content.

Tailwind: `rounded border border-[#1f2a36] bg-[#121821]/80 backdrop-blur-sm p-4`

Props: `children: ReactNode`, `className?: string`

File: `components/ui/Panel.tsx`

---

## 24. PanelHeader

Purpose: Header row for a Panel.

Tailwind:

- Container: `mb-3 flex items-center justify-between`
- Title: `text-base font-display font-semibold uppercase tracking-[0.04em]`

Props: `title: string`, `titleColor?: string`, `children?: ReactNode`

File: `components/ui/PanelHeader.tsx`

---

## 25. StatusDot

Purpose: Small colored dot indicating operational state.

Variants: `live`, `healthy`, `warning`, `danger`, `muted`

Tailwind: `inline-block h-2 w-2 rounded-full`

Color mapping:

- live/healthy: `bg-[#22c55e]`
- warning: `bg-[#f59e0b]`
- danger: `bg-[#ef4444]`
- muted: `bg-[#6b7280]`

File: `components/ui/StatusDot.tsx`

---

## 26. StatusBadge

Purpose: Compact state badge.

Variants: `active`, `idle`, `battle`, `cruise`, `pending`, `error`

Tailwind: `inline-flex items-center rounded px-2 py-0.5 text-[11px] uppercase tracking-[0.04em] font-semibold`

Color mappings:

- active: `bg-sky-500/15 text-sky-400`
- idle/pending: `bg-slate-500/15 text-slate-400`
- battle: `bg-red-500/15 text-red-400`
- cruise: `bg-sky-500/15 text-sky-400`
- error: `bg-rose-500/15 text-rose-400`

File: `components/ui/StatusBadge.tsx`

---

## 27. ProgressBar

Purpose: Linear fill bar. Used for playback progress and volume level visualization.

Tailwind:

- Outer: `relative w-full bg-[#1f2a36] rounded h-1 overflow-hidden`
- Fill: color varies by context (primary `#3fa7ff` for playback, `#ef4444` for battle mode volume)

Props: `value: number` (0–1), `color?: string`

File: `components/ui/ProgressBar.tsx`

---

## 28. Button

Purpose: Standard button primitive.

Variants: `primary`, `secondary`, `danger`, `ghost`

Tailwind: `inline-flex items-center justify-center rounded px-3 py-1.5 text-[13px] font-medium transition-colors`

Variant styles:

- primary: `bg-[#3fa7ff] text-white hover:brightness-110`
- secondary: `border border-[#2b3645] bg-transparent text-[#e6edf3] hover:bg-[#18212c]`
- danger: `bg-[#ef4444] text-white hover:brightness-110`
- ghost: `text-[#9aa4b2] hover:text-[#e6edf3] hover:bg-[#18212c]`

File: `components/ui/Button.tsx`

---

## 29. FormInput

Purpose: Standard text input.

Tailwind: `w-full rounded border border-[#253140] bg-[#0f141a] px-2 py-1.5 text-[13px] text-[#e6edf3] outline-none focus:border-[#3fa7ff] transition placeholder-[#6b7280]`

File: `components/ui/FormInput.tsx`

---

## 30. FormSelect

Purpose: Standard select input. Same visual language as FormInput.

File: `components/ui/FormSelect.tsx`

---

## 31. Tooltip

Purpose: Hover-activated informational overlay.

Visual treatment:

- `fixed z-50 bg-slate-900/70 backdrop-blur-md border border-cyan-500/30 rounded-md shadow-lg text-xs p-3 pointer-events-none`
- `max-width: 300px`
- Fade in/out via opacity transition

File: `components/ui/Tooltip.tsx`

---

## 32. ScopePrompt

Purpose: Inline prompt shown when a user accesses a feature that requires an ESI scope they did not grant.

Structure:

- Title: feature name + amber warning color
- Body: what the feature does and what they lose without the scope
- Buttons: "Reauthenticate to enable" (primary) + "Dismiss" (ghost)

Tailwind:

- Container: `rounded border border-[#253140] bg-[#0f141a] p-4 space-y-2 text-[13px]`
- Title: `text-sm font-display font-semibold uppercase tracking-[0.04em] text-[#f59e0b]`
- Body: `text-[#9aa4b2]`

Rules:

- Does not redirect or end the session — existing fleet room access is unaffected
- "Dismiss" hides the prompt for the remainder of the session
- "Reauthenticate" initiates a new ESI auth flow with the additional scope added; returns user to the same page on completion

Props: `gate: ScopeGate`, `onReauth: () => void`, `onDismiss: () => void`

File: `components/ui/ScopePrompt.tsx`

---

## 33. MetricRow

Purpose: Short label/value pair.

Tailwind: `flex items-center justify-between text-[13px]`

- Label: secondary text
- Value: primary text with `tabular-nums`

---

# Approved Layout Patterns

## Pattern A: Line Member Fleet Room

```
FleetShell                          ← single-page, no sidebar
├── FleetHeader (NowPlaying inline, VolumeIndicator, MuteToggle, ConnectionPill)
└── main (flex row, flex-1)
    ├── PlayerPanel (flex-1)
    │   ├── YouTube iframe
    │   └── NowPlaying (full)
    └── QueuePanel (w-80)
        ├── QueueTab
        ├── QueueList
        │   └── QueueEntry (× N)
        └── SubmitMediaForm
```

## Pattern B: FC Workspace — Fleet Room App

```
AppShell                            ← sidebar workspace
├── AppSidebar (Fleet Room active)
└── workspace
    └── AppWindow
        ├── AppWindowHeader ("Fleet Room" + ConnectionPill)
        ├── ModeBar (ModeToggle, skip controls)
        └── AppWindowBody
            └── main (flex row)
                ├── PlayerPanel (flex-1)
                │   ├── YouTube iframe
                │   └── NowPlaying (full)
                └── QueuePanel (w-80)
                    ├── QueueTab
                    ├── QueueList
                    │   └── QueueEntry (× N, with remove control)
                    └── SubmitMediaForm
```

## Pattern C: FC Workspace — Members App

```
AppShell
├── AppSidebar (Members active)
└── workspace
    └── AppWindow
        ├── AppWindowHeader ("Members")
        └── AppWindowBody
            ├── Panel (MemberRoster — full expanded view)
            └── Panel (Kick / management controls)
```

## Pattern D: FC Workspace — Queue Moderation App

```
AppShell
├── AppSidebar (Queue active)
└── workspace
    └── AppWindow
        ├── AppWindowHeader ("Queue Management")
        └── AppWindowBody
            ├── Panel
            │   ├── PanelHeader ("Cruise Queue")
            │   └── QueueList (with remove controls)
            └── Panel
                ├── PanelHeader ("Battle Queue")
                └── QueueList (with remove controls)
```

## Pattern E: FC Workspace — Settings App

```
AppShell
├── AppSidebar (Settings active)
└── workspace
    └── AppWindow
        ├── AppWindowHeader ("Fleet Settings")
        └── AppWindowBody
            └── Panel
                ├── PanelHeader ("General")
                ├── MetricRow (share link + copy button)
                └── form fields (FormInput, FormSelect, Button)
```

## Pattern F: Join Flow

```
Centered auth card (not a fleet room, no AppShell)
└── Panel
    ├── PanelHeader (fleet name)
    ├── FC character info (CharacterAvatar + name)
    └── "Join Fleet" Button (primary)
```

---

# Data Fetching Rules

- Use **TanStack Query** for REST API calls (fleet metadata, user profile, queue snapshot on load)
- Use **`useFleetParty`** hook for all real-time state (playback, votes, mode, member roster)
- Never call `fetch()` directly in components — use typed API functions from `src/lib/api.ts`
- Server components fetch initial data; client components subscribe to real-time updates via PartyKit

---

# Real-Time State Rules

- All fleet state (playback position, mode, queue, votes) comes from `FleetProvider` context
- Components read from context via typed selectors — never subscribe to raw PartyKit messages directly
- `FleetProvider` owns the `useFleetParty` hook and dispatches updates to a reducer
- Outgoing actions (vote, submit, mode change) are sent via `send()` from `useFleetParty` — never via REST for real-time operations

---

# Role Rendering Rules

- `session.role` lives in `FleetProvider` context — read via `useFleetSession()` hook
- FC-only components (`ModeBar`, remove buttons in queue) are **not rendered** for line members — not hidden with CSS
- Role checks happen in the parent layout component, not inside leaf components
- Leaf components are role-agnostic: they receive props and fire callbacks

---

# Operational UI Rules

1. Optimize for at-a-glance readability during active gameplay
2. Fleet mode (Cruise / Battle) must always be visually evident — color-code aggressively
3. Volume state must always be visible — players need to know if they're at 25%
4. Queue state must update in real time — no manual refresh
5. No playful or decorative UI
6. No oversized spacing, hero sections, or marketing-style layouts
7. Color conveys system meaning only — blue for cruise, red for battle, amber for warnings
8. FC navigation uses the `AppSidebar` icon pattern — no top nav, no breadcrumbs, no text-label nav bars
9. Line member navigation is zero — `FleetShell` is a single-room experience with no navigation at all

---

# File Organization

```
src/
├── components/
│   ├── shell/         # AppShell, AppSidebar, AppWindow, AppWindowHeader, AppWindowBody
│   │                  # FleetShell, FleetHeader, ModeBar
│   ├── player/        # PlayerPanel, NowPlaying, ModeToggle, VolumeIndicator, MuteToggle
│   ├── queue/         # QueuePanel, QueueTab, QueueList, QueueEntry, VoteButton, SubmitMediaForm
│   ├── fleet/         # MemberRoster
│   └── ui/            # Panel, PanelHeader, Button, FormInput, FormSelect, StatusDot,
│                      # StatusBadge, ProgressBar, Tooltip, MetricRow, ConnectionPill,
│                      # CharacterAvatar
├── app/
│   ├── fleet/
│   │   └── [fleetId]/
│   │       ├── page.tsx           # FC workspace (AppShell)
│   │       ├── members/page.tsx   # FC members app
│   │       ├── queue/page.tsx     # FC queue moderation app
│   │       └── settings/page.tsx  # FC settings app
│   └── join/
│       └── [token]/
│           └── page.tsx           # Line member fleet room (FleetShell)
├── lib/
│   ├── api.ts         # Typed fetch wrappers for /api/v1/*
│   ├── container.ts   # Composition root
│   └── hooks/
│       ├── useFleetParty.ts    # PartyKit connection + typed message dispatch
│       └── useFleetSession.ts  # Session + role from FleetProvider
└── providers/
    └── FleetProvider.tsx  # Real-time state context (mode, queue, playback, members)
```

---

# Generation Instructions

1. Use only approved components
2. **FC/leadership sessions** use `AppShell` + `AppSidebar` + `AppWindow` — the workspace model
3. **Line member sessions** use `FleetShell` — single-page, no sidebar, no workspace chrome
4. Never render `AppShell` or `AppSidebar` for line members; never render `FleetShell` for FCs
5. FC-only controls (`ModeBar`, queue remove buttons) are not rendered for line members — not hidden with CSS
6. Real-time data comes from `FleetProvider` context, not from TanStack Query
7. REST data (initial load, user profile) comes from TanStack Query via `src/lib/api.ts`
8. Keep components in the correct directory (`shell` / `player` / `queue` / `fleet` / `ui`)
9. Do not introduce new visual systems or color tokens
10. Role checks happen in layout/page components — leaf components are role-agnostic

---

# End of Contract
