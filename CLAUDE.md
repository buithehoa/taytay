# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Node >=18, ESM only, package manager is pnpm. There is no automated test suite yet — verification is via type-checking and the manual smoke test described in `README.md` (type `hello`, expect `you typed: hello`; type `exit` or press `Ctrl+C` to quit cleanly).

## Architecture

- `src/cli.tsx` — executable entrypoint, renders `<App>` via Ink's `render()`.
- `src/App.tsx` — root component; owns `history` state (`{ type: 'input' | 'output'; text: string }[]`), renders a `<Static>` scrollback list above a bordered `<PromptInput>`, and dispatches submitted input to the injected `CommandHandler`. Handles `Ctrl+C` and `exit`/`quit` input for clean shutdown; command errors are caught and rendered as `Error: ...` output lines rather than crashing.
- `src/components/Scrollback.tsx` — renders one transcript line (input lines styled cyan with a `>` prefix, output lines plain, `Error: `-prefixed output lines styled red).
- `src/components/PromptInput.tsx` — wraps `ink-text-input`, clearing on submit.
- `src/commands/index.ts` — the `CommandHandler` type and `defaultHandler`; this is the seam where real command interpretation logic replaces the echo placeholder.

`<Static>` is used for the scrollback so past lines are rendered once and never re-diffed — only the input box re-renders on keystrokes.
