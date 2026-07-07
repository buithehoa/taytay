# Command Dropdown Below Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the command autocomplete dropdown from a fixed-height area above the prompt input to a dynamically-sized area below it (Claude Code's behavior), removing the wasted blank space the current fixed 5-row reservation always occupies.

**Architecture:** `CommandDropdown` stops forcing a fixed height and blank-padding unused rows — it renders exactly as many rows as there are matches. `PromptInput` reorders its JSX so `CommandDropdown` is a sibling *after* the bordered input `Box` instead of before it. No other component, type, or business logic changes.

**Tech Stack:** TypeScript (strict, ESM, NodeNext), Ink 5, React 18, `ink-text-input` — same as the existing merged implementation.

## Global Constraints

- Node >=18, ESM only, pnpm. Relative imports use explicit `.js` extensions.
- No change to `Command`, `CommandResult`, `CommandRegistry`, `ExitCommand`, `EchoCommand`, or the `node:test` suite — this plan touches only `src/components/CommandDropdown.tsx` and `src/components/PromptInput.tsx`.
- `MAX_VISIBLE_MATCHES` changes from `5` to `10` (a cap on match count shown, not a reserved height — there is no reserved height anymore).
- Verification is type-check + manual smoke test, consistent with how the rest of this app's UI layer is verified (no `ink-testing-library` in the project itself).

---

### Task 1: Dynamic-height dropdown below the input

**Files:**
- Modify: `src/components/CommandDropdown.tsx`
- Modify: `src/components/PromptInput.tsx`

**Interfaces:**
- No signature changes. `CommandDropdown` still takes `{ matches: Command[]; focusedIndex: number }`; `MAX_VISIBLE_MATCHES` is still exported from `CommandDropdown.tsx` and still used by `PromptInput.tsx` to cap `registry.fuzzyMatch(...)` results — only its value and role change (cap on match count, not reserved rows).

- [ ] **Step 1: Replace `src/components/CommandDropdown.tsx`**

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { Command } from '../commands/Command.js';

export const MAX_VISIBLE_MATCHES = 10;

interface CommandDropdownProps {
  matches: Command[];
  focusedIndex: number;
}

export function CommandDropdown({ matches, focusedIndex }: CommandDropdownProps) {
  return (
    <Box flexDirection="column">
      {matches.map((command, index) => (
        <Text key={command.names[0]} inverse={index === focusedIndex}>
          {`/${command.names[0]} — ${command.description}`}
        </Text>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Replace `src/components/PromptInput.tsx`**

Only the `return` statement's JSX order changes (`<CommandDropdown>` moves from before to after the bordered input `Box`) — everything else in the file is unchanged from the current implementation:

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
  const [inputVersion, setInputVersion] = useState(0);

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
      setInputVersion((version) => version + 1);
    } else if (key.escape) {
      setDismissed(true);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderLeft={false} borderRight={false} paddingX={1}>
        <TextInput
          key={inputVersion}
          focus={isFocused}
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </Box>
      <CommandDropdown matches={matches} focusedIndex={focusedIndex} />
    </Box>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [ ] **Step 4: Confirm existing tests still pass**

Run: `pnpm test`
Expected: PASS (9 tests, unaffected — this change touches only presentational JSX)

- [ ] **Step 5: Manual smoke test**

Run: `pnpm dev`, then in the running terminal:
1. Type `/`. Expected: the input box is where it's always been; a two-row list (`/exit — Exit the application`, `/echo — Print the given text as a heading`) appears directly *below* the input, with `/exit` highlighted (inverse). No blank/empty rows above or below the two matches.
2. Delete the `/` (empty input). Expected: the dropdown disappears completely — no residual blank space where it was.
3. Type `/`, then `ec` (input is `/ec`). Expected: dropdown narrows to just the one `/echo — ...` row (not two blank rows, not five).
4. Press Tab. Expected: input becomes `/echo ` (trailing space), dropdown disappears (input now contains a space).
5. Type `Hello`, press Enter. Expected: bold yellow `Hello` appears in the scrollback; input clears.
6. Type `/`, press Down then Up. Expected: highlight moves to `/echo` then back to `/exit`, exactly as before this change.
7. Type `/`, press Escape. Expected: dropdown disappears, `/` remains in the input.
8. Type `/exit`, press Enter. Expected: `> /exit` in scrollback, input clears, app exits cleanly shortly after.

- [ ] **Step 6: Commit**

```bash
git add src/components/CommandDropdown.tsx src/components/PromptInput.tsx
git commit -m "fix: render command dropdown below input with dynamic height"
```
