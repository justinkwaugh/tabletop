# Viewport Layout Contract

## Goal

For game UIs that use `DefaultTableLayout` in either shell environment:

- standalone dev harness
- real frontend app shell

- In desktop browsers and installed PWAs, the page should occupy exactly the viewport height.
- In mobile browsers that expose unsafe browser UI regions, the page should occupy exactly the safe-area-adjusted usable viewport height.
- The page itself should not need to scroll during normal play.
- The left column, center game column, and right/debug column should fit exactly inside that solved height.
- The bottom gap should be exactly the `p-2` content padding from `DefaultTableLayout`, not an accidental extra inset from shell math.
- Inner content such as chat/history/board should size from the solved table height, not from independent `100vh` formulas.

## Ownership Model

There should be one authoritative height budget.

1. The active app shell owns the viewport.
2. The app shell spends the top safe area.
3. The app shell spends the actual rendered shell chrome:
   - shell navbar
   - hotseat banner, if present
   - exploration banner, if present
4. `DefaultTableLayout` receives only the remaining height.
5. `DefaultTableLayout` spends only its own internal padding and local controls.
6. Game-specific panels fill the remaining solved column height.

This means safe-area handling and shell-chrome handling belong above `DefaultTableLayout`, while panel/content sizing belongs inside it.

## Shell Environments

There are two real shell environments in this repo, and both must obey the same contract.

### Standalone Dev Harness

Files:

- [Harness.svelte](/Users/justin.w/dev/tabletop/libs/frontend-components/src/lib/components/Harness.svelte)
- [HarnessGame.svelte](/Users/justin.w/dev/tabletop/libs/frontend-components/src/lib/components/HarnessGame.svelte)

Used by standalone game UI packages such as:

- [games/indonesia-ui/src/routes/+page.svelte](/Users/justin.w/dev/tabletop/games/indonesia-ui/src/routes/+page.svelte)

### Real Frontend App Shell

Files:

- [apps/frontend/src/routes/(app)/+layout.svelte](/Users/justin.w/dev/tabletop/apps/frontend/src/routes/(app)/+layout.svelte)
- [apps/frontend/src/routes/(app)/(authed)/game/[id]/+page.svelte](/Users/justin.w/dev/tabletop/apps/frontend/src/routes/(app)/(authed)/game/[id]/+page.svelte)

This is the production website path and is the authoritative path for real-user layout behavior.

## Shared Requirement Across Shells

The game table must not encode shell-specific chrome heights.

Instead:

- each shell must measure and publish its own rendered shell height
- `DefaultTableLayout` must consume a shared shell-height contract
- game-specific content must size from that remaining height only

So the contract is shared, but the shell measurement source is environment-specific.

## Platform Rules

### Desktop Browser

- Available app height = viewport height.
- No safe-area top/bottom adjustment is expected.
- No page scroll during normal play.

### Installed PWA

- Available app height = viewport height exposed to the app.
- Safe-area insets should still be respected if the device reports them.
- No page scroll during normal play.

### Mobile Browser (non-PWA)

- Available app height = safe-area-adjusted usable viewport height.
- Top safe area belongs to the shell/navbar region.
- Bottom safe area belongs to the page shell or outer table container, not to arbitrary inner panels.
- No page scroll during normal play.

## Derived Layout Rules

### Shell

- Shell chrome height must be based on actual rendered height, not guessed constants.
- Any breakpoint-driven navbar height changes must automatically change the remaining table height.
- Hotseat and exploration banners must participate in the same measured shell height budget.

### DefaultTableLayout

- Must fill exactly the remaining shell height.
- Must not reserve top safe-area space internally; that space belongs to the shell.
- May reserve left/right/bottom safe-area padding if it is the outermost scrolling surface for table content.
- Internal `p-2` should be the only intentional bottom whitespace inside the table area.

### Columns

- Side and game columns should use the solved table height, not independent viewport math.
- `h-full` / flex sizing should derive from the table area.
- Chat/history/player lists should not compute their own `100vh` minus guessed offsets.

### Scaling Surface

- `ScalingWrapper` should scale within the solved game column height.
- Fullscreen/expanded mode is a separate presentation mode and may use different shell behavior, but contracted mode should obey the same solved table height.

## Current Indonesia Layout Mapping

### Current Chain: Standalone Harness

- [games/indonesia-ui/src/routes/+page.svelte](/Users/justin.w/dev/tabletop/games/indonesia-ui/src/routes/+page.svelte)
  - renders `Harness`
- [Harness.svelte](/Users/justin.w/dev/tabletop/libs/frontend-components/src/lib/components/Harness.svelte)
  - renders the top navbar and `HarnessGame`
- [HarnessGame.svelte](/Users/justin.w/dev/tabletop/libs/frontend-components/src/lib/components/HarnessGame.svelte)
  - optionally renders `HotseatPanel` or `ExplorationPanel`
  - renders game UI
- [GameTable.svelte](/Users/justin.w/dev/tabletop/games/indonesia-ui/src/lib/components/GameTable.svelte)
  - renders `DefaultTableLayout`
- [DefaultTableLayout.svelte](/Users/justin.w/dev/tabletop/libs/frontend-components/src/lib/components/DefaultTableLayout.svelte)
  - computes the table area and the left/center/right columns

### Current Chain: Real Frontend App

- [apps/frontend/src/routes/(app)/+layout.svelte](/Users/justin.w/dev/tabletop/apps/frontend/src/routes/(app)/+layout.svelte)
  - renders the real site navbar and app chrome
- [apps/frontend/src/routes/(app)/(authed)/game/[id]/+page.svelte](/Users/justin.w/dev/tabletop/apps/frontend/src/routes/(app)/(authed)/game/[id]/+page.svelte)
  - optionally renders `ExplorationPanel` / `HotseatPanel`
  - renders `GameUI`
- [GameUI.svelte](/Users/justin.w/dev/tabletop/libs/frontend-components/src/lib/components/GameUI.svelte)
  - attaches the game UI component
- [GameTable.svelte](/Users/justin.w/dev/tabletop/games/indonesia-ui/src/lib/components/GameTable.svelte)
  - renders `DefaultTableLayout`

### What Currently Matches the Contract

- In harness mode, top safe area is now allocated in `Harness`, not in the table content area.
- `DefaultTableLayout` now subtracts `var(--safe-area-top)` from available height instead of padding its own top.
- `HotseatPanel` and `ExplorationPanel` really are `44px` tall in the current implementation.
- Contracted game view uses `ScalingWrapper` inside a bounded column instead of raw page-height scaling.

### What Currently Does Not Match the Contract

1. `DefaultTableLayout` still uses hardcoded shell heights.

   File:
   - `libs/frontend-components/src/lib/components/DefaultTableLayout.svelte`

   Current assumptions:
   - navbar = `68px`
   - hotseat/exploration banner = `44px`
   - mobile “game title banner” = `32px`

   Problem:
   - the rendered shell height differs between harness and frontend
   - the navbar is rendered by Flowbite and can change with breakpoint/content
   - on the real frontend site, the small-viewport title row is part of the responsive navbar layout, not a separate measured shell component
   - this means the table math is still based on guessed chrome, not measured chrome

2. The real frontend app does not yet advertise the same safe-area viewport contract as the standalone game package.

   Files:
   - [apps/frontend/src/app.html](/Users/justin.w/dev/tabletop/apps/frontend/src/app.html)
   - [games/indonesia-ui/src/app.html](/Users/justin.w/dev/tabletop/games/indonesia-ui/src/app.html)

   Problem:
   - the standalone game package currently has `viewport-fit=cover`
   - the real frontend app currently does not
   - so safe-area behavior cannot yet be identical between the two environments

3. `GameChat` still uses its own viewport math.

   File:
   - `libs/frontend-components/src/lib/components/GameChat.svelte`

   Current default:
   - `100vh`-based formula with multiple hardcoded subtractions

   Problem:
   - this bypasses the solved table height
   - it can disagree with `DefaultTableLayout` even if outer shell math is correct
   - it uses `100vh`, not `100dvh`, and does not derive from the current safe-area-adjusted table box

4. The layout still mixes shell-owned height math and content-owned height math.

   Examples:
   - `DefaultTableLayout` computes shell offsets
   - `GameChat` computes another viewport budget
   - `GameTable` uses a local `min-h-[50dvh]` constraint for the board region

   Problem:
   - multiple independent height models make exact bottom alignment brittle

## Recommended Changes

### 1. Measure shell height instead of hardcoding it

Replace the `68px + 44px + 32px` model with a measured shell-height model.

Recommended shape:

- `Harness` measures the rendered height of its shell chrome
- frontend `(app)` layout measures the rendered height of its shell chrome
- It exposes a CSS custom property or context value such as:
  - `--app-shell-height`
- `DefaultTableLayout` uses:
  - `height: calc(100dvh - var(--app-shell-height) - var(--safe-area-top))`

This removes the need for guessed navbar height and makes breakpoint changes correct automatically.

### 2. Remove the standalone mobile `32px` subtraction unless a real measured owner exists

If there is no actual separate mobile title band in the shell, this subtraction should not exist.

If there is one, it should be represented by a real measured element, not a magic constant.

### 3. Align safe-area viewport settings between environments

If the real frontend app is expected to honor the same safe-area contract as standalone game packages, it should opt into the same viewport behavior.

That means the frontend app shell should make an explicit decision about `viewport-fit=cover` rather than silently diverging from the standalone package.

### 4. Make `GameChat` inherit solved height

Instead of defaulting to a `100vh` formula, `GameChat` should fill a parent height that is already solved by the table column.

Preferred model:

- outer side column has fixed solved height
- tabs content uses `h-full`
- chat panel uses `h-full`
- chat internal composer/message area divides that local height with flex

That keeps chat large when empty without inventing its own viewport budget.

### 5. Keep one vertical budget all the way down

The contracted game layout should have exactly one chain of vertical truth:

- viewport
- shell measured height
- table remaining height
- column height
- local flex splits

No child component should re-derive the viewport independently.

## Practical Interpretation

The target behavior is:

- desktop/PWA:
  - app exactly fills viewport
  - no page scroll
  - columns land exactly on the inner `p-2` bottom padding
- mobile browser:
  - app exactly fits the safe area
  - no page scroll
  - same bottom alignment rule

The current code is closer than before, but it is still not mathematically exact because:

- the shell height is still guessed instead of measured
- harness and frontend are still not normalized to the same viewport contract
- `GameChat` still uses a separate viewport formula
