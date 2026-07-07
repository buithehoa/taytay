# Command Autocomplete — Design

## Purpose

Add a slash-command system to `taytay`: typing `/` opens a fuzzy-filterable
dropdown of predefined commands, rendered as an overlay above the prompt
input (never shifting the input's position — a deliberate departure from
Claude Code/Codex, whose suggestion lists push the input as they appear).
Selecting and running a command executes real application logic instead of
the current echo placeholder, via a dedicated class per command. This also
replaces the scaffold's ad hoc bare-word `exit`/`quit` handling with a
proper `/exit` (aliased `/quit`) command, and introduces `/echo` as a proof
of concept that command output can be rich Ink content, not just plain text.

## UX behavior

- Typing `/` with an otherwise-empty input shows all registered commands in
  a dropdown.
- Continuing to type filters the dropdown via **fuzzy subsequence
  matching**: the typed characters must appear in the command name in
  order, not necessarily contiguously (e.g. `eio` matches `editor`). When
  more than one command matches, results are **ranked** by match quality
  (tighter, earlier matches first) using the `fuzzysort` library — ranking
  matters because the top-ranked match is what Enter executes by default.
- The dropdown is visible only while the input starts with `/` and
  contains no space yet (i.e. the user is still typing the command name,
  not an argument) and at least one command matches.
- **Tab**: fills the input with the focused match's canonical name plus a
  trailing space (e.g. `/echo `). Does not execute. Lets the user continue
  typing an argument before pressing Enter.
- **Enter**:
  - If the dropdown is visible: executes the *focused* command directly,
    using whatever follows the first space in the current input (if any)
    as its argument. Does not require the typed prefix to be the full
    command name.
  - Otherwise (no `/`, already has a space, or dismissed): submits the raw
    input text as today. If it starts with `/`, it's dispatched as a
    command requiring an *exact* name match; otherwise it falls through to
    the existing default (non-command) handler.
- **Up/Down**: move the focused row among the filtered matches, clamped
  (no wrap-around). Default focus is the top-ranked match.
- **Escape**: dismisses the dropdown without executing anything, leaving
  the typed text as-is. Dismissal is cleared (the dropdown can reopen) on
  the next keystroke that changes the input.
- The dropdown is implemented as an Ink `<Box position="absolute">`
  overlay anchored above the input row, which Ink excludes from normal
  flex layout — this is what prevents the input from shifting.

## Architecture

```
src/commands/
  Command.ts          # Command interface + CommandResult type
  registry.ts          # CommandRegistry: fuzzyMatch(), dispatch()
  ExitCommand.ts        # aliases: exit, quit
  EchoCommand.tsx        # .tsx: composes the Heading component
  index.ts              # existing CommandHandler/defaultHandler (unchanged
                         # fallback for non-slash input) + createCommandRegistry()
src/components/
  CommandDropdown.tsx    # new: presentational overlay list
  Heading.tsx             # new: shared rich-content component (bold + yellow)
  PromptInput.tsx         # modified: owns autocomplete state + key handling
  Scrollback.tsx          # modified: HistoryEntry.content replaces .text,
                           # renders ReactNode content as-is
src/App.tsx               # modified: removes bare exit/quit check, routes
                           # "/"-prefixed input through the command registry
test/commands/
  registry.test.ts
  echo.test.ts
package.json                # add "test": "node --test"; add fuzzysort dependency
```

New runtime dependency: `fuzzysort` (small, zero-dependency fuzzy string
matching and ranking library).

## Command model

```ts
// Command.ts
export interface CommandResult {
  output: string | React.ReactNode;  // '' means nothing added to history
  exit?: boolean;                     // true = app should quit after this
}

export interface Command {
  names: string[];   // e.g. ['exit', 'quit']; names[0] is canonical
  description: string;
  execute(arg: string): CommandResult | Promise<CommandResult>;
}
```

```ts
// ExitCommand.ts
export class ExitCommand implements Command {
  names = ['exit', 'quit'];
  description = 'Exit the application';
  execute(): CommandResult {
    return { output: '', exit: true };
  }
}
```

```tsx
// EchoCommand.tsx
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

```tsx
// components/Heading.tsx
import React from 'react';
import { Text } from 'ink';

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text bold color="yellow">{children}</Text>;
}
```

**Rich content principle:** commands may compose reusable presentational
components (like `Heading`) to produce rich `CommandResult.output`, but
should stay to a single JSX composition line — the actual markup/styling
lives in the component, not the command. There is no fixed set of content
"kinds"; a future table command would add `components/Table.tsx` the same
way `EchoCommand` uses `Heading`.

`registry.ts`:

```ts
export class CommandRegistry {
  private commands: Command[];

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  fuzzyMatch(query: string): Command[] {
    if (query === '') {
      return this.commands;
    }
    // For each command, take the best fuzzysort score across its names
    // (a command matches if any of its names match); sort descending by
    // that score; commands with no matching name are excluded.
    return this.commands
      .map((command) => ({
        command,
        score: Math.max(...command.names.map((name) => fuzzysort.single(query, name)?.score ?? -Infinity)),
      }))
      .filter(({ score }) => score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .map(({ command }) => command);
  }

  dispatch(line: string): CommandResult | Promise<CommandResult> {
    const withoutSlash = line.slice(1);
    const spaceIdx = withoutSlash.indexOf(' ');
    const name = spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx);
    const arg = spaceIdx === -1 ? '' : withoutSlash.slice(spaceIdx + 1);
    const command = this.commands.find((c) => c.names.includes(name));
    if (!command) {
      return { output: `Error: Unknown command: /${name}` };
    }
    return command.execute(arg);
  }
}

export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry([new ExitCommand(), new EchoCommand()]);
}
```

## Components

`Scrollback.tsx` — `HistoryEntry.text` is renamed to `.content` and widened
to `string | React.ReactNode`:

```tsx
export interface HistoryEntry {
  type: 'input' | 'output';
  content: string | React.ReactNode;
}

export function Scrollback({ entry }: ScrollbackProps) {
  if (entry.type === 'input') {
    return <Text color="cyan">{'> '}{entry.content}</Text>;
  }
  if (typeof entry.content !== 'string') {
    return <>{entry.content}</>;
  }
  const isError = entry.content.startsWith('Error: ');
  return <Text color={isError ? 'red' : undefined}>{entry.content}</Text>;
}
```

`PromptInput.tsx` gains autocomplete state (`focusedIndex`, `dismissed`),
derives visible matches from the current value on every render, and adds a
second `useInput` hook (coexisting with `ink-text-input`'s own, which only
reacts to left/right/backspace/character-input/Enter — Tab/Up/Down/Escape
pass through untouched) to implement the key table from the UX section
above. On Enter with the dropdown visible, it resolves the submission to
`` /${focused.names[0]} ${argAfterFirstSpace ?? ''} `` before calling
`onSubmit` — so `App.tsx` always receives a plain string and never needs to
know whether the dropdown was involved.

`CommandDropdown.tsx` is purely presentational: given
`{ matches: Command[]; focusedIndex: number }`, renders each as
`` /name — description `` , highlighting the focused row, inside a
`<Box position="absolute">` anchored directly above the input row.

## Data flow (`App.tsx`)

```tsx
const commandRegistry = useMemo(() => createCommandRegistry(), []);

const handleSubmit = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return;

  setHistory((h) => [...h, { type: 'input', content: trimmed }]);

  void (async () => {
    try {
      const result = trimmed.startsWith('/')
        ? await commandRegistry.dispatch(trimmed)
        : { output: await handler(trimmed) };  // existing default handler, unchanged

      if (result.output !== '') {
        setHistory((h) => [...h, { type: 'output', content: result.output }]);
      }
      if ('exit' in result && result.exit) {
        setIsExiting(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHistory((h) => [...h, { type: 'output', content: `Error: ${message}` }]);
    }
  })();
};
```

The old bare `trimmed === 'exit' || trimmed === 'quit'` special case
(which skipped history and left the input uncleared) is removed. `/exit`
now goes through the same path as every other command: `"> /exit"` is
added to history, the input clears immediately (via `ink-text-input`'s
normal submit behavior — `PromptInput`'s `onSubmit` no longer needs the
old `boolean | void` "don't clear" escape hatch), and the app quits after
the existing short delay (`EXIT_RENDER_DELAY_MS`) once `result.exit` is
seen.

## Error handling

- Unknown slash command (`/nonsense`) → `dispatch` returns
  `{ output: 'Error: Unknown command: /nonsense' }`, rendered red via the
  existing `Error: ` prefix convention (now behind a `typeof` guard since
  `content` may be a `ReactNode`).
- A command's `execute()` throwing → caught by the existing try/catch in
  `handleSubmit`, rendered as `Error: <message>`, unchanged from today.
- Empty `/echo` argument → renders an empty heading; not an error.
- Dropdown with zero fuzzy matches → dropdown doesn't render; Enter falls
  through to the normal dispatch path, which produces the "Unknown
  command" error if the text still doesn't resolve to an exact name.

## Testing

`node --test` (new `test` script, no new test-runner dependency) covers
the pure command-logic layer:

- `registry.test.ts` — exact-match dispatch for `/echo hello` and
  `/exit`/`/quit` (alias), dispatch of an unknown command produces the
  error string, argument splitting on the first space, `fuzzyMatch` with
  an empty query returns all commands in registration order, a subsequence
  query matches non-contiguous characters in order, and a query matching
  multiple commands ranks the tighter match first.
- `echo.test.ts` — `EchoCommand.execute('Hello')` returns a `Heading`
  element whose `children` is `'Hello'`.

UI behavior (dropdown rendering, keyboard interaction) stays manually
smoke-tested, consistent with the rest of the app — no `ink-testing-library`
yet.

## Out of scope

- Commands beyond `/exit`, `/quit`, `/echo`.
- A structured-data/central-renderer architecture for rich content (the
  reusable-component approach was chosen instead; revisit only if a future
  command's content can't reasonably be expressed as a composed component).
- Command history navigation (Up/Down are reserved for dropdown focus, not
  recalling previously submitted lines).
- Persisting or configuring the command list outside of source code.
