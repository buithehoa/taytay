# Blank TUI App Scaffold Implementation Plan

**Status: Completed.** Executed by Codex; see commits `5ca0f8d`..`c576058` on `main`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a minimal Ink + React + TypeScript TUI app in this repo — a scrolling transcript with a prompt box pinned to the bottom, wired to a pluggable (currently no-op/echo) command handler.

**Architecture:** A single Ink `<App>` root component holds transcript state and renders a `<Static>` scrollback list above a bordered `<PromptInput>` box. Submitting input pushes an entry to history, calls a swappable `CommandHandler` function, and pushes the result. `cli.tsx` is the executable entrypoint that renders `<App>`.

**Tech Stack:** Ink 5, React 18, TypeScript (strict, ESM, NodeNext module resolution), `ink-text-input`, pnpm, Node >=18.

## Global Constraints

- Node >=18, ESM only (`"type": "module"` in package.json).
- Package manager: pnpm.
- TypeScript strict mode; relative imports must use explicit `.js` extensions (required by `moduleResolution: NodeNext` even though source files are `.ts`/`.tsx`).
- Typed input is interpreted by application logic, never executed as a shell command.
- No test framework/harness in this scaffold (per spec, deferred until there's real command behavior to test). Each task's deliverable is instead verified via `pnpm exec tsc --noEmit` (type-check) and, where noted, a manual run-and-observe smoke test with exact steps.
- `history` entries are `{ type: 'input' | 'output'; text: string }` — exactly two variants. Error output is represented as a `type: 'output'` entry whose `text` starts with the literal prefix `Error: `, not a third type.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a working pnpm project with `dev`/`build`/`start` scripts, and a TypeScript compiler configured for `src/` → `dist/`. Later tasks assume `pnpm exec tsc --noEmit` and `pnpm exec tsc` both work from repo root.

- [x] **Step 1: Write `package.json`**

```json
{
  "name": "taytay",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "taytay": "./dist/cli.js"
  },
  "scripts": {
    "dev": "tsx src/cli.tsx",
    "build": "tsc && chmod +x dist/cli.js",
    "start": "node dist/cli.js"
  },
  "dependencies": {
    "ink": "^5.0.1",
    "ink-text-input": "^6.0.0",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "tsx": "^4.16.0",
    "typescript": "^5.5.4"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [x] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false
  },
  "include": ["src/**/*"]
}
```

- [x] **Step 3: Update `.gitignore`**

Append these two lines to the existing `.gitignore`:

```
node_modules/
dist/
```

- [x] **Step 4: Install dependencies**

Run: `pnpm install`
Expected: completes without error, creates `node_modules/` and `pnpm-lock.yaml`.

- [x] **Step 5: Verify the TypeScript compiler is wired up**

Run: `pnpm exec tsc --version`
Expected: prints a `Version 5.x.x` line (no error).

- [x] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold pnpm/TypeScript project for taytay TUI"
```

---

### Task 2: Command dispatch module

**Files:**
- Create: `src/commands/index.ts`

**Interfaces:**
- Produces: `CommandHandler` type (`(input: string) => string | Promise<string>`) and `defaultHandler: CommandHandler`, imported by `src/App.tsx` (Task 5) and `src/cli.tsx` (Task 6).

- [x] **Step 1: Write `src/commands/index.ts`**

```ts
export type CommandHandler = (input: string) => string | Promise<string>;

export const defaultHandler: CommandHandler = async (input) => {
  return `you typed: ${input}`;
};
```

- [x] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 3: Commit**

```bash
git add src/commands/index.ts
git commit -m "feat: add pluggable command handler with echo default"
```

---

### Task 3: Scrollback component

**Files:**
- Create: `src/components/Scrollback.tsx`

**Interfaces:**
- Produces: `HistoryEntry` type (`{ type: 'input' | 'output'; text: string }`) and `Scrollback` component (props: `{ entry: HistoryEntry }`), imported by `src/App.tsx` (Task 5).

- [x] **Step 1: Write `src/components/Scrollback.tsx`**

```tsx
import React from 'react';
import { Text } from 'ink';

export interface HistoryEntry {
  type: 'input' | 'output';
  text: string;
}

interface ScrollbackProps {
  entry: HistoryEntry;
}

export function Scrollback({ entry }: ScrollbackProps) {
  if (entry.type === 'input') {
    return (
      <Text color="cyan">
        {'> '}
        {entry.text}
      </Text>
    );
  }

  const isError = entry.text.startsWith('Error: ');
  return <Text color={isError ? 'red' : undefined}>{entry.text}</Text>;
}
```

- [x] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 3: Commit**

```bash
git add src/components/Scrollback.tsx
git commit -m "feat: add Scrollback component for transcript lines"
```

---

### Task 4: Prompt input component

**Files:**
- Create: `src/components/PromptInput.tsx`

**Interfaces:**
- Produces: `PromptInput` component (props: `{ onSubmit: (value: string) => void }`), imported by `src/App.tsx` (Task 5).

- [x] **Step 1: Write `src/components/PromptInput.tsx`**

```tsx
import React, { useState } from 'react';
import TextInput from 'ink-text-input';

interface PromptInputProps {
  onSubmit: (value: string) => void;
}

export function PromptInput({ onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (submitted: string) => {
    setValue('');
    onSubmit(submitted);
  };

  return <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />;
}
```

- [x] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 3: Commit**

```bash
git add src/components/PromptInput.tsx
git commit -m "feat: add PromptInput component wrapping ink-text-input"
```

---

### Task 5: Root App component

**Files:**
- Create: `src/App.tsx`

**Interfaces:**
- Consumes: `HistoryEntry`, `Scrollback` from `./components/Scrollback.js` (Task 3); `PromptInput` from `./components/PromptInput.js` (Task 4); `CommandHandler` from `./commands/index.js` (Task 2).
- Produces: `App` component (props: `{ handler: CommandHandler }`), imported by `src/cli.tsx` (Task 6).

- [x] **Step 1: Write `src/App.tsx`**

```tsx
import React, { useState } from 'react';
import { Box, Static, useApp, useInput } from 'ink';
import { Scrollback, HistoryEntry } from './components/Scrollback.js';
import { PromptInput } from './components/PromptInput.js';
import { CommandHandler } from './commands/index.js';

interface AppProps {
  handler: CommandHandler;
}

export function App({ handler }: AppProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }

    setHistory((h) => [...h, { type: 'input', text: trimmed }]);

    if (trimmed === 'exit' || trimmed === 'quit') {
      exit();
      return;
    }

    try {
      const result = await handler(trimmed);
      setHistory((h) => [...h, { type: 'output', text: result }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHistory((h) => [...h, { type: 'output', text: `Error: ${message}` }]);
    }
  };

  return (
    <Box flexDirection="column">
      <Static items={history}>
        {(entry, i) => <Scrollback key={i} entry={entry} />}
      </Static>
      <Box borderStyle="round" paddingX={1}>
        <PromptInput onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
```

- [x] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add root App component with scrollback, input, and exit handling"
```

---

### Task 6: CLI entrypoint & dev smoke test

**Files:**
- Create: `src/cli.tsx`

**Interfaces:**
- Consumes: `App` from `./App.js` (Task 5); `defaultHandler` from `./commands/index.js` (Task 2).

- [x] **Step 1: Write `src/cli.tsx`**

```tsx
#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { defaultHandler } from './commands/index.js';

render(<App handler={defaultHandler} />);
```

- [x] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 3: Manual smoke test in dev mode**

Run: `pnpm dev`
Then, in the running terminal:
1. Type `hello` and press Enter.
   Expected: a cyan `> hello` line appears above the input box, followed by a `you typed: hello` line, and the bordered input box remains pinned at the bottom, now empty.
2. Type `exit` and press Enter.
   Expected: the process exits cleanly, returning to the shell prompt (no stack trace, no hang).
3. Run `pnpm dev` again and press `Ctrl+C`.
   Expected: the process exits cleanly.

- [x] **Step 4: Commit**

```bash
git add src/cli.tsx
git commit -m "feat: add cli entrypoint rendering the App"
```

---

### Task 7: Build pipeline verification

**Files:** none (verification only)

- [x] **Step 1: Build**

Run: `pnpm build`
Expected: completes with no errors; creates `dist/cli.js`, `dist/App.js`, `dist/commands/index.js`, `dist/components/Scrollback.js`, `dist/components/PromptInput.js`.

- [x] **Step 2: Verify the built entrypoint is executable**

Run: `ls -l dist/cli.js`
Expected: permission bits include `x` (e.g. `-rwxr-xr-x`), confirming the `chmod +x` in the `build` script ran.

- [x] **Step 3: Manual smoke test against the built output**

Run: `pnpm start`
Then repeat the same three checks as Task 6 Step 3 (`hello` echoes, `exit` quits cleanly, re-running and pressing `Ctrl+C` quits cleanly).

- [x] **Step 4: Commit**

No source changes in this task — nothing to commit. If `pnpm build` or the smoke test surfaces a bug, fix it in the relevant task's file, re-run that task's type-check, then commit the fix with an appropriate message before continuing.
