# `/connect` Command — Design

## Purpose

Add a `/connect` command that opens a full-screen "Settings" view for
managing third-party integrations (LastFm, Spotify), modeled visually on
Claude Code's own `/config` screen. This is the first command that needs to
take over the whole terminal view and its keyboard input — everything built
so far (`/echo`, `/exit`) just appends a line of output to the scrollback and
leaves the prompt box focused. That gap is the main thing this design closes;
the LastFm/Spotify connection logic itself is stubbed for now.

## UX behavior

Running `/connect` replaces the scrollback + prompt with a bordered "Settings"
screen:

```
╭──────────────────────────────────────────╮
│ Settings                                  │
│                                            │
│ Integration   Other                       │
│ ──────────────────────────────────────    │
│                                            │
│ ▸ LastFm                        Connect   │
│   Spotify                       Connected │
│                                            │
│                                            │
│ Esc to cancel · ↑/↓ to select ·           │
│ Space/Enter to toggle · Tab to switch tabs │
╰──────────────────────────────────────────╯
```

- **Two tabs**: `Integration` (active by default) and `Other`. `Other` is an
  empty placeholder ("Nothing here yet.") for this version — no content is
  designed for it yet.
- **`Tab`** switches between the two tabs.
- **Integration tab** lists two rows, `LastFm` and `Spotify`, each showing a
  connect/disconnect control on the right.
- **`↑`/`↓`** move focus between rows (Integration tab only; wraps not
  required, clamps at the ends).
- **`Space` or `Enter`** activates the focused row:
  - If the service is disconnected (or in the error state): start
    connecting.
  - If the service is connected: start disconnecting.
- **Row states**, left to right through a connect attempt:
  `Connect` (default color) → spinner (connecting) → `Connected` (green).
  On failure: spinner → `Connect` (red), until the next attempt.
  Disconnecting is the mirror: `Connected` → spinner (disconnecting) →
  `Connect`.
- **A footer hint line** at the bottom of the screen always lists the
  available shortcuts: `Esc to cancel · ↑/↓ to select · Space/Enter to
  toggle · Tab to switch tabs`.
- **`Esc`** closes the screen and returns to the normal transcript + prompt
  view. The `> /connect` line typed to invoke it remains visible in the
  scrollback, same as any other command. If a connect/disconnect is still in
  progress when the user leaves, it keeps running in the background; the
  result is reflected next time `/connect` is opened.

## Architecture

The existing command model (`src/commands/`) only supports commands that
return a value appended once to the scrollback (`CommandResult.output`),
while the prompt box (`PromptInput`) keeps input focus permanently. `/connect`
needs to own keyboard input itself (arrows, tab, space/enter, escape) and
re-render as its state changes, which nothing in the app currently supports.

Rather than special-case `/connect` in `App.tsx`, the command result contract
gains one new optional capability so any future command can take over the
screen the same way:

```ts
// src/commands/Command.ts
export interface CommandResult {
  output: string | ReactNode;
  exit?: boolean;
  screen?: React.ComponentType<{ onClose: () => void }>;
}
```

In `App.tsx`, `<Static items={history}>` stays mounted for the lifetime of
the app, unchanged — Ink's `<Static>` prints each item exactly once, so
unmounting and remounting it would risk reprinting the whole transcript.
Only the *live region below it* swaps:

```tsx
<Box flexDirection="column">
  <Static items={history}>{...}</Static>
  {activeScreen
    ? <activeScreen.Component onClose={() => setActiveScreen(null)} />
    : <PromptInput ... />}
</Box>
```

`handleSubmit` sets `activeScreen` when a dispatched command's result
includes `screen`, instead of (or in addition to) pushing output to history.
`ConnectCommand` returns `{ output: '', screen: ConnectScreen }`.

## New modules

- **`src/commands/ConnectCommand.tsx`** — registers `names = ['connect']` in
  the existing `CommandRegistry` (so it fuzzy-matches in the autocomplete
  dropdown like other commands), returns `{ output: '', screen: ConnectScreen }`.

- **`src/services/connectors.ts`** — defines the seam real integrations will
  eventually implement:

  ```ts
  export interface ServiceConnector {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  }
  ```

  For this version, a stub factory (`createStubConnector`) produces a
  connector that resolves after a fixed simulated delay (~800ms) and always
  succeeds. Real LastFm/Spotify OAuth flows are out of scope and will replace
  the stub later without changing anything above this interface.

- **`src/services/connectionStore.ts`** — a small in-memory singleton (module
  state + subscribe/notify listeners, no file I/O) tracking each service's
  status:

  ```ts
  type ConnectionStatus =
    | 'disconnected' | 'connecting' | 'connected'
    | 'disconnecting' | 'error';
  ```

  It lives outside the screen component's lifecycle so that leaving the
  screen mid-operation (Esc) doesn't lose track of the in-flight
  connect/disconnect — the store keeps the promise running and updates
  status when it settles, regardless of whether `ConnectScreen` is currently
  mounted. Status resets to `disconnected` on app restart; nothing is
  persisted to disk.

- **`src/components/ConnectScreen.tsx`** — the top-level screen component.
  Owns active-tab state (`'integration' | 'other'`), renders the "Settings"
  title, the tab row, the active tab's content, and the footer hint line.
  Handles `Tab` (switch tabs) and `Esc` (calls `onClose`).

- **`src/components/IntegrationTab.tsx`** — renders the LastFm and Spotify
  rows from a small config array (`{ id, label, connector }`), owns the
  focused-row index, handles `↑`/`↓` (move focus) and `Space`/`Enter`
  (call `connectionStore`'s toggle for the focused row).

- **`src/components/OtherTab.tsx`** — placeholder content only
  (`"Nothing here yet."`).

- **New dependency: `ink-spinner`** — same maintainer as `ink`, provides the
  loading indicator shown during `connecting`/`disconnecting`. Nothing in the
  codebase provides a spinner today.

## Error handling

- A failed `connect()`/`disconnect()` (rejected promise) moves that row's
  status to `error`, rendered as `Connect` in red. The next `Space`/`Enter`
  on that row retries (moves it back to `connecting`).
- Command dispatch errors (e.g. `ConnectScreen` throwing during render)
  continue to be caught the same way `App.tsx` already catches command
  execution errors — this design doesn't change that path.
- `Ctrl+C` continues to exit the whole app immediately, even while `/connect`
  is open, unchanged from current behavior.

## Testing

- **`connectionStore`**: unit tests for status transitions (`disconnected` →
  `connecting` → `connected`, and the `error` path) and subscribe/notify
  behavior — pure logic, no rendering needed, using the existing
  `tsx --test` setup.
- **`ConnectCommand`**: unit test that it registers under `/connect` and
  returns a result with a `screen`.
- **`ConnectScreen` / `IntegrationTab`**: keyboard-driven behavior (arrow
  navigation, tab switching, space/enter toggling, escape closing) needs an
  Ink rendering harness. Add `ink-testing-library` as a dev dependency to
  cover this — the codebase has no interactive-component test coverage yet,
  and this is the first component that needs it.

## Out of scope

- Real LastFm/Spotify OAuth (API credentials, browser-based auth, token
  exchange) — `connectors.ts` defines the interface; only the stub is built
  now.
- Persisting connection status across app restarts (config file, token
  storage).
- Any content for the "Other" tab beyond the empty placeholder.
- Cancelling an in-flight connect/disconnect when the user leaves the screen.
