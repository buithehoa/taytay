# Command Autocomplete Implementation Plan

**Status: Completed.** Implemented by commits `febf24b..05a9cb7` on branch `codex/command-autocomplete`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slash-command system to `taytay` — typing `/` opens a fuzzy-filterable dropdown of predefined commands in a fixed-height area above the input (never shifting it), executed via per-command classes, replacing the scaffold's echo placeholder and ad hoc bare-word exit/quit handling.

**Architecture:** A `Command` interface + `CommandRegistry` (fuzzy match via `fuzzysort`, exact-match dispatch) drives two concrete commands (`ExitCommand` aliasing `quit`/`exit`, `EchoCommand` as a rich-content proof of concept via a shared `Heading` component). `PromptInput` owns autocomplete state and renders a fixed-height `CommandDropdown` above its own input row; `App.tsx` routes `/`-prefixed submissions through the registry and everything else through the existing default handler.

**Tech Stack:** TypeScript (strict, ESM, NodeNext), Ink 5, React 18, `ink-text-input`, `fuzzysort`, `node:test` run via `tsx --test`.

## Global Constraints

- Node >=18, ESM only, pnpm. Relative imports must use explicit `.js` extensions (NodeNext module resolution).
- `CommandResult.output` is `string | React.ReactNode`; `''` means nothing is added to history.
- `HistoryEntry.type` is exactly `'input' | 'output'` — no third variant. Errors are `type: 'output'` entries whose string content starts with the literal prefix `Error: `.
- A command may compose reusable presentational components (like `Heading`) but should stay to a single JSX composition line in its own file — no central "content kind" renderer.
- The command dropdown reserves a **fixed height of 5 rows** in normal flex flow, always rendered (blank-padded when closed or under 5 matches) — this is the mechanism verified (via `ink-testing-library` frame snapshots) to keep the input from shifting. Ink's `Box` has no CSS-style `top`/`bottom` anchor; `position="absolute"` was tried and rejected (it overlaps/corrupts the input row with no margin, and clips invisibly with a negative `marginTop`).
- Tests are `node:test` run via `tsx --test` (no new test-runner dependency) and cover only pure command-logic (`CommandRegistry`, `EchoCommand`) — UI stays manually smoke-tested, consistent with the rest of the app.

---

### Task 1: Add fuzzysort dependency and test script

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: a working `pnpm test` script and the `fuzzysort` dependency, both required by later tasks.

- [x] **Step 1: Update `package.json`**

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
    "start": "node dist/cli.js",
    "test": "tsx --test test/commands/*.test.ts"
  },
  "dependencies": {
    "fuzzysort": "^3.1.0",
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

- [x] **Step 2: Install**

Run: `pnpm install`
Expected: completes without error, `fuzzysort` added to `node_modules` and `pnpm-lock.yaml`.

- [x] **Step 3: Verify fuzzysort resolves**

Run: `pnpm exec node --input-type=module -e "import fuzzysort from 'fuzzysort'; console.log(typeof fuzzysort.single)"`
Expected: prints `function`

(`pnpm test` isn't run yet — no test files exist until Task 4.)

- [x] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add fuzzysort dependency and test script"
```

---

### Task 2: Command interface and CommandResult type

**Files:**
- Create: `src/commands/Command.ts`

**Interfaces:**
- Produces: `Command` interface (`names: string[]`, `description: string`, `execute(arg: string): CommandResult | Promise<CommandResult>`) and `CommandResult` (`{ output: string | React.ReactNode; exit?: boolean }`), consumed by every task from here on.

- [x] **Step 1: Write `src/commands/Command.ts`**

```ts
import type { ReactNode } from 'react';

export interface CommandResult {
  output: string | ReactNode;
  exit?: boolean;
}

export interface Command {
  names: string[];
  description: string;
  execute(arg: string): CommandResult | Promise<CommandResult>;
}
```

- [x] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 3: Commit**

```bash
git add src/commands/Command.ts
git commit -m "feat: add Command interface and CommandResult type"
```

---

### Task 3: ExitCommand

**Files:**
- Create: `src/commands/ExitCommand.ts`

**Interfaces:**
- Consumes: `Command`, `CommandResult` from `./Command.js` (Task 2).
- Produces: `ExitCommand` class (`names: ['exit', 'quit']`), consumed by `registry.ts` (Task 5). Its behavior is verified indirectly via `registry.test.ts`'s dispatch tests in Task 5, not a dedicated test file here.

- [x] **Step 1: Write `src/commands/ExitCommand.ts`**

```ts
import { Command, CommandResult } from './Command.js';

export class ExitCommand implements Command {
  names = ['exit', 'quit'];
  description = 'Exit the application';

  execute(): CommandResult {
    return { output: '', exit: true };
  }
}
```

- [x] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 3: Commit**

```bash
git add src/commands/ExitCommand.ts
git commit -m "feat: add ExitCommand (aliases exit and quit)"
```

---

### Task 4: Heading component and EchoCommand

**Files:**
- Create: `src/components/Heading.tsx`
- Create: `src/commands/EchoCommand.tsx`
- Test: `test/commands/echo.test.ts`

**Interfaces:**
- Consumes: `Command`, `CommandResult` from `../commands/Command.js` (Task 2).
- Produces: `Heading` component (props: `{ children: React.ReactNode }`), `EchoCommand` class (`names: ['echo']`), consumed by `registry.ts` (Task 5).

- [x] **Step 1: Write the failing test**

```ts
// test/commands/echo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidElement } from 'react';
import { EchoCommand } from '../../src/commands/EchoCommand.js';

test('EchoCommand echoes the given argument as a Heading element', () => {
  const command = new EchoCommand();
  const result = command.execute('Hello World');
  assert.ok(isValidElement(result.output));
  if (isValidElement(result.output)) {
    assert.equal((result.output.props as { children: string }).children, 'Hello World');
  }
});

test('EchoCommand is registered under the name "echo"', () => {
  const command = new EchoCommand();
  assert.deepEqual(command.names, ['echo']);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module `../../src/commands/EchoCommand.js` (the file doesn't exist yet).

- [x] **Step 3: Write `src/components/Heading.tsx`**

```tsx
import React from 'react';
import { Text } from 'ink';

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text bold color="yellow">{children}</Text>;
}
```

- [x] **Step 4: Write `src/commands/EchoCommand.tsx`**

```tsx
import React from 'react';
import { Heading } from '../components/Heading.js';
import { Command, CommandResult } from './Command.js';

export class EchoCommand implements Command {
  names = ['echo'];
  description = 'Print the given text as a heading';

  execute(arg: string): CommandResult {
    return { output: <Heading>{arg}</Heading> };
  }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS (2 tests)

- [x] **Step 6: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 7: Commit**

```bash
git add src/components/Heading.tsx src/commands/EchoCommand.tsx test/commands/echo.test.ts
git commit -m "feat: add EchoCommand with Heading rich-content output"
```

---

### Task 5: CommandRegistry

**Files:**
- Create: `src/commands/registry.ts`
- Modify: `src/commands/index.ts`
- Test: `test/commands/registry.test.ts`

**Interfaces:**
- Consumes: `Command`, `CommandResult` (Task 2); `ExitCommand` (Task 3); `EchoCommand` (Task 4).
- Produces: `CommandRegistry` class (`fuzzyMatch(query: string): Command[]`, `dispatch(line: string): CommandResult | Promise<CommandResult>`) and `createCommandRegistry(): CommandRegistry`, both exported from `src/commands/index.ts` and consumed by `App.tsx` (Task 6) and `PromptInput.tsx` (Task 7).

- [x] **Step 1: Write the failing test**

```ts
// test/commands/registry.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidElement } from 'react';
import { createCommandRegistry, CommandRegistry } from '../../src/commands/index.js';
import type { Command } from '../../src/commands/Command.js';

function makeCommand(name: string): Command {
  return {
    names: [name],
    description: '',
    execute: () => ({ output: name }),
  };
}

test('dispatch runs /echo with its argument', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/echo hello');
  assert.ok(isValidElement(result.output));
  if (isValidElement(result.output)) {
    assert.equal((result.output.props as { children: string }).children, 'hello');
  }
});

test('dispatch runs /exit and signals exit', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/exit');
  assert.deepEqual(result, { output: '', exit: true });
});

test('dispatch runs /quit as an alias for exit', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/quit');
  assert.deepEqual(result, { output: '', exit: true });
});

test('dispatch returns an error for an unknown command', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/nonsense');
  assert.deepEqual(result, { output: 'Error: Unknown command: /nonsense' });
});

test('fuzzyMatch with an empty query returns all commands in registration order', () => {
  const registry = createCommandRegistry();
  const names = registry.fuzzyMatch('').map((c) => c.names[0]);
  assert.deepEqual(names, ['exit', 'echo']);
});

test('fuzzyMatch matches a non-contiguous subsequence', () => {
  const registry = new CommandRegistry([makeCommand('editor')]);
  const matches = registry.fuzzyMatch('eio');
  assert.deepEqual(matches.map((c) => c.names[0]), ['editor']);
});

test('fuzzyMatch ranks the tighter match first', () => {
  const registry = new CommandRegistry([makeCommand('editor'), makeCommand('echo')]);
  const matches = registry.fuzzyMatch('eo');
  assert.equal(matches[0].names[0], 'echo');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module `../../src/commands/index.js`'s exports `createCommandRegistry`/`CommandRegistry` (they don't exist yet).

- [x] **Step 3: Write `src/commands/registry.ts`**

```ts
import fuzzysort from 'fuzzysort';
import { Command, CommandResult } from './Command.js';

export class CommandRegistry {
  private commands: Command[];

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  fuzzyMatch(query: string): Command[] {
    if (query === '') {
      return this.commands;
    }

    return this.commands
      .map((command) => ({
        command,
        score: Math.max(
          ...command.names.map((name) => fuzzysort.single(query, name)?.score ?? -Infinity)
        ),
      }))
      .filter(({ score }) => score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .map(({ command }) => command);
  }

  dispatch(line: string): CommandResult | Promise<CommandResult> {
    const withoutSlash = line.slice(1);
    const spaceIndex = withoutSlash.indexOf(' ');
    const name = spaceIndex === -1 ? withoutSlash : withoutSlash.slice(0, spaceIndex);
    const arg = spaceIndex === -1 ? '' : withoutSlash.slice(spaceIndex + 1);
    const command = this.commands.find((c) => c.names.includes(name));
    if (!command) {
      return { output: `Error: Unknown command: /${name}` };
    }
    return command.execute(arg);
  }
}
```

- [x] **Step 4: Update `src/commands/index.ts`**

Replace the full contents of `src/commands/index.ts` with:

```ts
import { CommandRegistry } from './registry.js';
import { ExitCommand } from './ExitCommand.js';
import { EchoCommand } from './EchoCommand.js';

export type CommandHandler = (input: string) => string | Promise<string>;

export const defaultHandler: CommandHandler = async (input) => {
  return `you typed: ${input}`;
};

export type { Command, CommandResult } from './Command.js';
export { CommandRegistry } from './registry.js';

export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry([new ExitCommand(), new EchoCommand()]);
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS (7 tests in `registry.test.ts`, plus the 2 from `echo.test.ts` — 9 total)

- [x] **Step 6: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 7: Commit**

```bash
git add src/commands/registry.ts src/commands/index.ts test/commands/registry.test.ts
git commit -m "feat: add CommandRegistry with fuzzy matching and dispatch"
```

---

### Task 6: Wire the command registry into the app (no dropdown UI yet)

**Files:**
- Modify: `src/components/Scrollback.tsx`
- Modify: `src/components/PromptInput.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `createCommandRegistry`, `CommandResult`, `CommandHandler` from `./commands/index.js` (Task 5).
- Produces: `HistoryEntry` now has `content: string | React.ReactNode` (renamed from `text`), consumed by `Scrollback` and `App.tsx`. `PromptInput`'s `onSubmit` prop simplifies to `(value: string) => void` (drops the old `boolean | void` "don't clear" escape hatch).

This task makes typing a full command line (e.g. `/echo hello`, `/exit`) work end-to-end via Enter, without any autocomplete dropdown — that's added in Task 7.

- [x] **Step 1: Replace `src/components/Scrollback.tsx`**

```tsx
import React from 'react';
import { Text } from 'ink';

export interface HistoryEntry {
  type: 'input' | 'output';
  content: string | React.ReactNode;
}

interface ScrollbackProps {
  entry: HistoryEntry;
}

export function Scrollback({ entry }: ScrollbackProps) {
  if (entry.type === 'input') {
    return (
      <Text color="cyan">
        {'> '}
        {entry.content}
      </Text>
    );
  }

  if (typeof entry.content !== 'string') {
    return <>{entry.content}</>;
  }

  const isError = entry.content.startsWith('Error: ');
  return <Text color={isError ? 'red' : undefined}>{entry.content}</Text>;
}
```

- [x] **Step 2: Replace `src/components/PromptInput.tsx`**

```tsx
import React, { useState } from 'react';
import TextInput from 'ink-text-input';

interface PromptInputProps {
  isFocused?: boolean;
  onSubmit: (value: string) => void;
}

export function PromptInput({ isFocused = true, onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (submitted: string) => {
    setValue('');
    onSubmit(submitted);
  };

  return (
    <TextInput
      focus={isFocused}
      value={value}
      onChange={setValue}
      onSubmit={handleSubmit}
    />
  );
}
```

- [x] **Step 3: Replace `src/App.tsx`**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Static, useApp, useInput, useStdout } from 'ink';
import { Scrollback, HistoryEntry } from './components/Scrollback.js';
import { PromptInput } from './components/PromptInput.js';
import { CommandHandler, CommandResult, createCommandRegistry } from './commands/index.js';

const EXIT_RENDER_DELAY_MS = 50;

interface AppProps {
  handler: CommandHandler;
}

export function App({ handler }: AppProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isExiting, setIsExiting] = useState(false);
  const { exit } = useApp();
  const { write } = useStdout();
  const commandRegistry = useMemo(() => createCommandRegistry(), []);

  useEffect(() => {
    if (isExiting) {
      const timeout = setTimeout(() => {
        write('\n');
        exit();
      }, EXIT_RENDER_DELAY_MS);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [exit, isExiting, write]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }

    setHistory((h) => [...h, { type: 'input', content: trimmed }]);

    void (async () => {
      try {
        const result: CommandResult = trimmed.startsWith('/')
          ? await commandRegistry.dispatch(trimmed)
          : { output: await handler(trimmed) };

        if (result.output !== '') {
          setHistory((h) => [...h, { type: 'output', content: result.output }]);
        }
        if (result.exit) {
          setIsExiting(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setHistory((h) => [...h, { type: 'output', content: `Error: ${message}` }]);
      }
    })();
  };

  return (
    <Box flexDirection="column">
      <Static items={history}>
        {(entry, i) => <Scrollback key={i} entry={entry} />}
      </Static>
      <Box borderStyle="round" borderLeft={false} borderRight={false} paddingX={1}>
        <PromptInput isFocused={!isExiting} onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
```

- [x] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 5: Confirm existing tests still pass**

Run: `pnpm test`
Expected: PASS (9 tests, unaffected by these UI-layer changes)

- [x] **Step 6: Manual smoke test**

Run: `pnpm dev`, then in the running terminal:
1. Type `/echo Hello World` and press Enter. Expected: bold yellow `Hello World` appears above the input.
2. Type `/nonsense` and press Enter. Expected: red `Error: Unknown command: /nonsense`.
3. Type `hi` and press Enter. Expected: `you typed: hi` (default handler unchanged).
4. Type `/exit` and press Enter. Expected: `> /exit` appears in the scrollback, the input clears immediately, and the process exits cleanly shortly after.
5. Run `pnpm dev` again, type `/quit`, press Enter. Expected: same clean-exit behavior as `/exit`.

- [x] **Step 7: Commit**

```bash
git add src/components/Scrollback.tsx src/components/PromptInput.tsx src/App.tsx
git commit -m "feat: dispatch slash commands through CommandRegistry"
```

---

### Task 7: Command dropdown UI

**Files:**
- Create: `src/components/CommandDropdown.tsx`
- Modify: `src/components/PromptInput.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Command` from `../commands/Command.js` (Task 2); `CommandRegistry` from `../commands/index.js` (Task 5).
- Produces: `CommandDropdown` component (props: `{ matches: Command[]; focusedIndex: number }`) and `MAX_VISIBLE_MATCHES` constant (`5`), both consumed by `PromptInput.tsx`. `PromptInput` gains a required `registry: CommandRegistry` prop.

- [x] **Step 1: Write `src/components/CommandDropdown.tsx`**

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { Command } from '../commands/Command.js';

export const MAX_VISIBLE_MATCHES = 5;

interface CommandDropdownProps {
  matches: Command[];
  focusedIndex: number;
}

export function CommandDropdown({ matches, focusedIndex }: CommandDropdownProps) {
  const rows = Array.from({ length: MAX_VISIBLE_MATCHES }, (_, i) => matches[i]);

  return (
    <Box flexDirection="column" height={MAX_VISIBLE_MATCHES}>
      {rows.map((command, index) =>
        command ? (
          <Text key={command.names[0]} inverse={index === focusedIndex}>
            {`/${command.names[0]} — ${command.description}`}
          </Text>
        ) : (
          <Text key={`blank-${index}`}> </Text>
        )
      )}
    </Box>
  );
}
```

- [x] **Step 2: Replace `src/components/PromptInput.tsx`**

The border that used to wrap `<PromptInput>` from `App.tsx` moves in here, now wrapping only the `TextInput` row — `CommandDropdown` sits above it as a sibling, both inside a column `Box`:

```tsx
import React, { useState } from 'react';
import { Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { CommandDropdown, MAX_VISIBLE_MATCHES } from './CommandDropdown.js';
import { CommandRegistry } from '../commands/index.js';

interface PromptInputProps {
  isFocused?: boolean;
  onSubmit: (value: string) => void;
  registry: CommandRegistry;
}

function argAfterFirstSpace(value: string): string {
  const spaceIndex = value.indexOf(' ');
  return spaceIndex === -1 ? '' : value.slice(spaceIndex + 1);
}

export function PromptInput({ isFocused = true, onSubmit, registry }: PromptInputProps) {
  const [value, setValue] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const commandToken =
    value.startsWith('/') && !value.includes(' ') ? value.slice(1) : null;
  const matches =
    commandToken !== null && !dismissed
      ? registry.fuzzyMatch(commandToken).slice(0, MAX_VISIBLE_MATCHES)
      : [];
  const dropdownVisible = matches.length > 0;

  const handleChange = (nextValue: string) => {
    setValue(nextValue);
    setDismissed(false);
    setFocusedIndex(0);
  };

  const handleSubmit = (submitted: string) => {
    const resolved = dropdownVisible
      ? `/${matches[focusedIndex].names[0]} ${argAfterFirstSpace(submitted)}`
      : submitted;
    setValue('');
    onSubmit(resolved);
  };

  useInput((input, key) => {
    if (!dropdownVisible) {
      return;
    }
    if (key.upArrow) {
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setFocusedIndex((i) => Math.min(matches.length - 1, i + 1));
    } else if (key.tab) {
      setValue(`/${matches[focusedIndex].names[0]} `);
    } else if (key.escape) {
      setDismissed(true);
    }
  });

  return (
    <Box flexDirection="column">
      <CommandDropdown matches={matches} focusedIndex={focusedIndex} />
      <Box borderStyle="round" borderLeft={false} borderRight={false} paddingX={1}>
        <TextInput
          focus={isFocused}
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </Box>
    </Box>
  );
}
```

- [x] **Step 3: Modify `src/App.tsx`**

Replace the return statement — the bordered `<Box>` that used to wrap `<PromptInput>` is gone (the border now lives inside `PromptInput`, from Step 2), and `PromptInput` gets the new `registry` prop:

```tsx
  return (
    <Box flexDirection="column">
      <Static items={history}>
        {(entry, i) => <Scrollback key={i} entry={entry} />}
      </Static>
      <PromptInput
        isFocused={!isExiting}
        onSubmit={handleSubmit}
        registry={commandRegistry}
      />
    </Box>
  );
```

- [x] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 5: Confirm existing tests still pass**

Run: `pnpm test`
Expected: PASS (9 tests, unaffected)

- [x] **Step 6: Manual smoke test**

Run: `pnpm dev`, then in the running terminal:
1. Type `/`. Expected: dropdown shows two rows, `/exit — Exit the application` and `/echo — Print the given text as a heading`, with `/exit` highlighted (inverse) by default. The bordered input row does not move.
2. Press Down. Expected: highlight moves to `/echo`. Press Up. Expected: highlight moves back to `/exit`.
3. Type `ec` (input is now `/ec`). Expected: dropdown narrows to just `/echo — ...`.
4. Press Tab. Expected: input becomes `/echo ` (trailing space), dropdown disappears (input now contains a space).
5. Type `Hello`, press Enter. Expected: bold yellow `Hello` appears in the scrollback; input clears.
6. Type `/`, then press Escape. Expected: dropdown disappears, `/` remains in the input.
7. Type `e` (input is now `/e`). Expected: dropdown reopens, showing both `/exit` and `/echo`.
8. With `/exit` focused, press Enter directly (no Tab). Expected: `> /exit` appears in the scrollback, input clears, app exits cleanly shortly after.
9. Run `pnpm dev` again, type `hi`, press Enter. Expected: `you typed: hi` (default handler still works, unaffected by the dropdown).

- [x] **Step 7: Commit**

```bash
git add src/components/CommandDropdown.tsx src/components/PromptInput.tsx src/App.tsx
git commit -m "feat: add fuzzy-filterable command dropdown above the prompt"
```
