# Blank TUI App Scaffold — Design

## Purpose

Scaffold a minimal terminal UI application in this repo, built with the same
stack Claude Code's own TUI uses (Ink + React + TypeScript). The app should
look and feel like Claude Code's interface: a scrolling transcript area with
a prompt box pinned to the bottom of the terminal. Typed input is not a shell
command — it will be interpreted by custom application logic added later.
This scaffold provides the shell (layout, input handling, scrollback) and a
pluggable seam for that logic, with no real command behavior yet.

## Stack

- **Ink** (React renderer for terminal UIs), using Yoga for flexbox layout —
  the actual rendering library Claude Code's TUI is built on.
- **React** for the component model.
- **TypeScript**, strict mode, ESM.
- **pnpm** as the package manager.
- Node >=18 (required by current Ink/React versions).

## Project structure

```
taytay/
  package.json
  tsconfig.json
  src/
    cli.tsx              # entrypoint (shebang), renders <App/>
    App.tsx              # root component: layout + state + key handling
    components/
      Scrollback.tsx      # <Static> list of past input/output lines
      PromptInput.tsx     # pinned bottom input box (wraps ink-text-input)
    commands/
      index.ts            # CommandHandler type + default echo implementation
  .gitignore              # add node_modules/, dist/
```

- Dependencies: `react`, `ink`, `ink-text-input`.
- Dev dependencies: `typescript`, `tsx`, `@types/react`, `@types/node`.
- `package.json` scripts:
  - `dev` — `tsx src/cli.tsx` (runs directly, no build step, fast iteration).
  - `build` — `tsc` compiles `src/` to `dist/`.
  - `start` — runs the built `dist/cli.js`.
- `package.json` declares a `bin` entry (`taytay` → `dist/cli.js`) so the
  built app is runnable as a standalone command.
- `tsconfig.json`: target ES2022, `jsx: react-jsx`, strict mode enabled.

## Components & layout

`App.tsx` is the root component. It holds application state:

```ts
history: { type: 'input' | 'output'; text: string }[]
```

and renders a column layout:

```tsx
<Box flexDirection="column">
  <Static items={history}>
    {(entry, i) => <Scrollback key={i} entry={entry} />}
  </Static>
  <Box borderStyle="round" paddingX={1}>
    <PromptInput onSubmit={handleSubmit} />
  </Box>
</Box>
```

- `<Static>` is Ink's mechanism for content that renders once and is never
  re-diffed on subsequent renders — this is the pattern Claude Code uses for
  its scrollback/transcript so old lines aren't redrawn on every keystroke.
  Only the bottom input box re-renders live as the user types.
- `PromptInput.tsx` wraps `ink-text-input`, tracking its own `value` in local
  state, clearing on submit, and calling `onSubmit(value)` up to `App`.
- `Scrollback.tsx` is a thin presentational component. Input lines and output
  lines get distinct styling (e.g. a `>` prefix + color for input lines,
  plain text for output lines).

## Data flow & command dispatch

The scaffold defines a pluggable seam so real command logic can be added
later without touching UI code:

```ts
// src/commands/index.ts
export type CommandHandler = (input: string) => string | Promise<string>;

export const defaultHandler: CommandHandler = async (input) => {
  return `you typed: ${input}`;
};
```

On submit, `App.tsx`:
1. Pushes `{ type: 'input', text }` onto `history`.
2. Calls `await handler(text)`.
3. Pushes `{ type: 'output', text: result }` onto `history`.

`defaultHandler` is the only piece meant to be replaced when real command
logic is built; layout, scrollback, and the input box stay untouched.

## Error handling

- `Ctrl+C` and a built-in `exit`/`quit` input both call Ink's `useApp().exit()`
  for a clean shutdown, matching Claude Code's own exit affordances.
- The call to `handler()` is wrapped in try/catch. If it throws, the error
  message is pushed to `history` as an output line (styled as an error)
  instead of crashing the process.
- Terminal resize is handled automatically by Ink/Yoga; no custom logic
  needed.

## Testing

Skipped for this initial scaffold — there is no real command logic yet to
exercise. `ink-testing-library` (renders to a string buffer, assertable) is
the standard choice and should be added once there's actual behavior worth
testing.

## Out of scope

- Real command interpretation logic (the `defaultHandler` is a placeholder).
- Persistence, config files, history-across-sessions.
- Distribution/publishing (npm publish, standalone binary packaging).
