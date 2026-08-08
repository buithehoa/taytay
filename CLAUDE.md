# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Codex, etc.) when working with code in this repository. Codex is configured (`.codex/config.toml`) to fall back to this file since there's no separate `AGENTS.md`.

## Status

`taytay` is a terminal UI application built with Ink, React, and TypeScript — modeled on Claude Code's own TUI: a scrolling transcript with a prompt box pinned to the bottom. Typed input is not a shell command; it's dispatched to a pluggable `CommandHandler` (currently a no-op echo implementation) for the application to interpret.

Design spec: `docs/superpowers/specs/2026-07-05-blank-tui-scaffold-design.md`
Implementation plan: `docs/superpowers/plans/2026-07-05-blank-tui-scaffold.md`

## Commands

- `pnpm install` — install dependencies
- `pnpm dev` — run the TUI directly from TypeScript source (via `tsx`)
- `pnpm exec tsc --noEmit` — type-check
- `pnpm build` — compile to `dist/` (also chmods `dist/cli.js` executable)
- `pnpm start` — run the built output (`dist/cli.js`)
- `pnpm test` — run the automated test suite (`tsx --test` over `test/commands/`, `test/components/`, `test/services/`)

Node >=18, ESM only, package manager is pnpm. New tests go in the matching `test/` subdirectory, following the existing `node:test` + `node:assert/strict` pattern. There's also a manual smoke test described in `README.md` (type `hello`, expect `you typed: hello`; type `/connect` to exercise the Settings screen; type `exit` or press `Ctrl+C` to quit cleanly).

## Architecture

- `src/cli.tsx` — executable entrypoint, renders `<App>` via Ink's `render()`.
- `src/App.tsx` — root component; owns `history` state (`{ type: 'input' | 'output'; content: string | React.ReactNode }[]`), renders a `<Static>` scrollback list that stays permanently mounted, with a live region below it that swaps between a bordered `<PromptInput>` and an active full-screen command component. Dispatches submitted input to the injected `CommandHandler`. Handles `Ctrl+C` and `exit`/`quit` input for clean shutdown; command errors are caught and rendered as `Error: ...` output lines rather than crashing.
- `src/components/Scrollback.tsx` — renders one transcript line (input lines styled cyan with a `>` prefix, output lines plain, `Error: `-prefixed output lines styled red).
- `src/components/PromptInput.tsx` — wraps `ink-text-input`, clearing on submit.
- `src/commands/index.ts` — the `CommandHandler` type and `defaultHandler`; this is the seam where real command interpretation logic replaces the echo placeholder. A command's `execute()` returns a `CommandResult`, which can include a `screen` component (see the `CommandResult.screen` seam below) in addition to plain `output` text.
- `src/commands/ConnectCommand.tsx` — the `/connect` command; returns `ConnectScreen` as its `CommandResult.screen`.
- `src/components/ConnectScreen.tsx` — full-screen Settings UI with Integration/Other tabs; closes via `onClose` on Esc.
- `src/components/IntegrationTab.tsx` / `src/components/OtherTab.tsx` — the Integration tab (LastFm/Spotify rows, connect/disconnect toggling) and a placeholder Other tab.
- `src/services/connectors.ts` — the `ServiceConnector` interface (`connect`/`disconnect`) plus a stubbed implementation.
- `src/services/connectionStore.ts` — an in-memory connection status store (`createConnectionStore`), plus a default singleton `connectionStore` used outside of tests. It lives independent of any screen component's lifecycle, so an in-flight connect/disconnect keeps running and is reflected next time the screen reopens.

`CommandResult.screen` is the seam in `App.tsx` where a command replaces `PromptInput` in the live region below the permanently-mounted `<Static>` scrollback with its own full-screen component; that component calls the `onClose` prop it receives to hand control back to `PromptInput`.

`<Static>` is used for the scrollback so past lines are rendered once and never re-diffed — only the input box re-renders on keystrokes.

## Working with superpowers plans

Plans and specs live under `docs/superpowers/plans/` and `docs/superpowers/specs/`. The `executing-plans` and `subagent-driven-development` skills track task progress via ephemeral todos only — they do not update the plan file itself. So after a plan's tasks are all done (whichever agent/tool executed them), before wrapping up:

1. Check off every completed step in the plan file (`- [ ]` → `- [x]`).
2. Add a `**Status: Completed.**` line right under the title, noting the commit range that implemented it.

This keeps a finished plan from looking like open work on a later pass.
