# `/connect` Command Implementation Plan

**Status: Completed.** Implemented by commits `1f2fe29` through `646da12` on `main` (Tasks 1-6); Task 7 (full verification + automated smoke-test substitute) closed out in the commit that added this status line.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/connect` command that opens a full-screen "Settings" UI for managing LastFm/Spotify integrations (stubbed connectors), introducing the `CommandResult.screen` seam so commands can take over the terminal view and keyboard input.

**Architecture:** `CommandResult` gains an optional `screen` field (a React component type taking `{ onClose }`). `App.tsx` keeps `<Static>` scrollback mounted for the app's lifetime and swaps only the live region below it between `PromptInput` and the active screen. Connection state lives in an in-memory `connectionStore` singleton (subscribe/notify) outside component lifecycles, so an in-flight connect/disconnect survives closing the screen. Connectors are a `ServiceConnector` interface with a stub implementation resolving after ~800ms.

**Tech Stack:** Ink 5, React 18, TypeScript (strict, ESM, NodeNext), `ink-spinner` (new dependency), `ink-testing-library` (new dev dependency), `node:test` via `tsx --test`, pnpm.

Design spec: `docs/superpowers/specs/2026-08-08-connect-command-design.md`

## Global Constraints

- Node >=18, ESM only (`"type": "module"`), package manager pnpm.
- TypeScript strict mode; relative imports use explicit `.js` extensions (required by `moduleResolution: NodeNext`).
- `pnpm exec tsc --noEmit` type-checks `src/` only (tsconfig `include` is `src/**/*`); test files are verified by running them (`pnpm test` = `tsx --test`).
- Tests use `node:test` + `node:assert/strict`, kebab-case filenames (e.g. `registry.test.ts`, `prompt-input.test.tsx`), matching the existing files in `test/`.
- `<Static items={history}>` in `App.tsx` must stay mounted for the lifetime of the app — never unmount/remount it (Ink prints each item exactly once; remounting risks reprinting the transcript).
- Exact UI copy (verbatim from spec): screen title `Settings`; tabs `Integration` and `Other`; rows `LastFm` and `Spotify`; row states `Connect` (default color), spinner, `Connected` (green), `Connect` (red on error); Other-tab placeholder `Nothing here yet.`; footer hint `Esc to cancel · ↑/↓ to select · Space/Enter to toggle · Tab to switch tabs`.
- Arrow navigation clamps at the ends (no wrapping).
- Stub connector simulated delay: 800ms default, always succeeds.
- Connection status is in-memory only — nothing persisted to disk; resets to `disconnected` on app restart.
- `Ctrl+C` exits the whole app immediately, including while the `/connect` screen is open (this already works via `App.tsx`'s `useInput` and must not be broken).
- Out of scope: real OAuth, persistence, Other-tab content, cancelling in-flight operations on screen close.

---

### Task 1: Stub service connector

**Files:**
- Create: `src/services/connectors.ts`
- Test: `test/services/connectors.test.ts`
- Modify: `package.json` (extend the `test` script glob to cover `test/services/`)

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `interface ServiceConnector { connect(): Promise<void>; disconnect(): Promise<void>; }` and `createStubConnector(delayMs?: number): ServiceConnector` (default delay 800ms, always resolves). Used by `connectionStore.toggle(serviceId, connector)` (Task 2) and the `INTEGRATION_SERVICES` config array (Task 3).

- [x] **Step 1: Write the failing test**

Create `test/services/connectors.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStubConnector } from '../../src/services/connectors.js';

test('stub connector connect() resolves after the given delay', async () => {
  const connector = createStubConnector(5);
  const start = Date.now();
  await connector.connect();
  assert.ok(Date.now() - start >= 4, 'should wait roughly the configured delay');
});

test('stub connector disconnect() resolves', async () => {
  const connector = createStubConnector(5);
  await connector.disconnect();
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test test/services/connectors.test.ts`
Expected: FAIL — cannot find module `src/services/connectors.js`.

- [x] **Step 3: Write the implementation**

Create `src/services/connectors.ts`:

```ts
export interface ServiceConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

const DEFAULT_STUB_DELAY_MS = 800;

export function createStubConnector(
  delayMs: number = DEFAULT_STUB_DELAY_MS,
): ServiceConnector {
  const settleAfterDelay = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });

  return {
    connect: settleAfterDelay,
    disconnect: settleAfterDelay,
  };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm exec tsx --test test/services/connectors.test.ts`
Expected: PASS (2 tests).

- [x] **Step 5: Extend the `test` script glob**

In `package.json`, change the `test` script from:

```json
"test": "tsx --test test/commands/*.test.ts test/components/*.test.tsx"
```

to:

```json
"test": "tsx --test test/commands/*.test.ts test/components/*.test.tsx test/services/*.test.ts"
```

Run: `pnpm test`
Expected: all existing tests plus the two new connector tests pass.

- [x] **Step 6: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 7: Commit**

```bash
git add src/services/connectors.ts test/services/connectors.test.ts package.json
git commit -m "feat: add ServiceConnector interface with stub implementation"
```

---

### Task 2: Connection status store

**Files:**
- Create: `src/services/connectionStore.ts`
- Test: `test/services/connection-store.test.ts`

**Interfaces:**
- Consumes: `ServiceConnector` from `src/services/connectors.js` (Task 1).
- Produces:
  - `type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error'`
  - `interface ConnectionStore { getStatus(serviceId: string): ConnectionStatus; subscribe(listener: () => void): () => void; toggle(serviceId: string, connector: ServiceConnector): void; }`
  - `createConnectionStore(): ConnectionStore` (factory, used by tests for isolated instances)
  - `connectionStore: ConnectionStore` (module-level singleton, used by `IntegrationTab` in Task 3)
- `toggle` semantics: from `disconnected`/`error` start a connect (`connecting` → `connected`, or `error` on rejection); from `connected` start a disconnect (`disconnecting` → `disconnected`, or `error` on rejection); ignored while `connecting`/`disconnecting`. Because the promise continuations live in the store (module state), an operation keeps running and settles even if the screen unmounts — this is what lets Esc leave mid-operation per the spec.

- [x] **Step 1: Write the failing tests**

Create `test/services/connection-store.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnectionStore } from '../../src/services/connectionStore.js';
import type { ServiceConnector } from '../../src/services/connectors.js';

class ManualConnector implements ServiceConnector {
  connectCalls = 0;
  disconnectCalls = 0;
  private resolveNext: (() => void) | null = null;
  private rejectNext: ((err: Error) => void) | null = null;

  connect(): Promise<void> {
    this.connectCalls += 1;
    return new Promise((resolve, reject) => {
      this.resolveNext = resolve;
      this.rejectNext = reject;
    });
  }

  disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    return new Promise((resolve, reject) => {
      this.resolveNext = resolve;
      this.rejectNext = reject;
    });
  }

  async settle(): Promise<void> {
    this.resolveNext?.();
    await new Promise((resolve) => setImmediate(resolve));
  }

  async fail(): Promise<void> {
    this.rejectNext?.(new Error('boom'));
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('unknown service defaults to disconnected', () => {
  const store = createConnectionStore();
  assert.equal(store.getStatus('lastfm'), 'disconnected');
});

test('toggle from disconnected goes connecting then connected', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  assert.equal(store.getStatus('lastfm'), 'connecting');

  await connector.settle();
  assert.equal(store.getStatus('lastfm'), 'connected');
  assert.equal(connector.connectCalls, 1);
});

test('a rejected connect moves the status to error, and toggling retries', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  await connector.fail();
  assert.equal(store.getStatus('lastfm'), 'error');

  store.toggle('lastfm', connector);
  assert.equal(store.getStatus('lastfm'), 'connecting');
  assert.equal(connector.connectCalls, 2);

  await connector.settle();
  assert.equal(store.getStatus('lastfm'), 'connected');
});

test('toggle from connected goes disconnecting then disconnected', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  await connector.settle();

  store.toggle('lastfm', connector);
  assert.equal(store.getStatus('lastfm'), 'disconnecting');
  assert.equal(connector.disconnectCalls, 1);

  await connector.settle();
  assert.equal(store.getStatus('lastfm'), 'disconnected');
});

test('toggle is ignored while an operation is in flight', () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();

  store.toggle('lastfm', connector);
  store.toggle('lastfm', connector);
  assert.equal(connector.connectCalls, 1);
  assert.equal(store.getStatus('lastfm'), 'connecting');
});

test('subscribers are notified on every transition; unsubscribe stops notifications', async () => {
  const store = createConnectionStore();
  const connector = new ManualConnector();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });

  store.toggle('lastfm', connector); // -> connecting
  assert.equal(calls, 1);

  await connector.settle(); // -> connected
  assert.equal(calls, 2);

  unsubscribe();
  store.toggle('lastfm', connector); // -> disconnecting
  assert.equal(calls, 2);
});

test('services are tracked independently', async () => {
  const store = createConnectionStore();
  const lastfm = new ManualConnector();

  store.toggle('lastfm', lastfm);
  await lastfm.settle();

  assert.equal(store.getStatus('lastfm'), 'connected');
  assert.equal(store.getStatus('spotify'), 'disconnected');
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec tsx --test test/services/connection-store.test.ts`
Expected: FAIL — cannot find module `src/services/connectionStore.js`.

- [x] **Step 3: Write the implementation**

Create `src/services/connectionStore.ts`:

```ts
import type { ServiceConnector } from './connectors.js';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface ConnectionStore {
  getStatus(serviceId: string): ConnectionStatus;
  subscribe(listener: () => void): () => void;
  toggle(serviceId: string, connector: ServiceConnector): void;
}

export function createConnectionStore(): ConnectionStore {
  const statuses = new Map<string, ConnectionStatus>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setStatus = (serviceId: string, status: ConnectionStatus) => {
    statuses.set(serviceId, status);
    notify();
  };

  return {
    getStatus(serviceId) {
      return statuses.get(serviceId) ?? 'disconnected';
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggle(serviceId, connector) {
      const status = statuses.get(serviceId) ?? 'disconnected';
      if (status === 'disconnected' || status === 'error') {
        setStatus(serviceId, 'connecting');
        connector.connect().then(
          () => setStatus(serviceId, 'connected'),
          () => setStatus(serviceId, 'error'),
        );
      } else if (status === 'connected') {
        setStatus(serviceId, 'disconnecting');
        connector.disconnect().then(
          () => setStatus(serviceId, 'disconnected'),
          () => setStatus(serviceId, 'error'),
        );
      }
      // status is 'connecting' or 'disconnecting': operation in flight — ignore.
    },
  };
}

export const connectionStore: ConnectionStore = createConnectionStore();
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec tsx --test test/services/connection-store.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 6: Commit**

```bash
git add src/services/connectionStore.ts test/services/connection-store.test.ts
git commit -m "feat: add in-memory connection status store with subscribe/notify"
```

---

### Task 3: IntegrationTab component

**Files:**
- Create: `src/components/IntegrationTab.tsx`
- Test: `test/components/integration-tab.test.tsx`
- Modify: `package.json` + `pnpm-lock.yaml` (via `pnpm add`)

**Interfaces:**
- Consumes: `ServiceConnector`, `createStubConnector` from `src/services/connectors.js` (Task 1); `ConnectionStatus`, `ConnectionStore`, `connectionStore` from `src/services/connectionStore.js` (Task 2); `Spinner` from `ink-spinner` (new dependency).
- Produces: `interface IntegrationService { id: string; label: string; connector: ServiceConnector; }`; `INTEGRATION_SERVICES: IntegrationService[]` (LastFm + Spotify with default stub connectors); `IntegrationTab` component with props `{ services?: IntegrationService[]; store?: ConnectionStore }` (both optional, defaulting to `INTEGRATION_SERVICES` and the `connectionStore` singleton — the optional props exist for test injection). Rendered by `ConnectScreen` (Task 4) with no props.
- Keyboard: `↑`/`↓` move the focused row (clamped at the ends, no wrap); `Space` or `Enter` (`key.return`) calls `store.toggle(service.id, service.connector)` for the focused row. `Tab`/`Esc` are deliberately not handled here (they belong to `ConnectScreen`).

- [x] **Step 1: Install the new dependencies**

Run:

```bash
pnpm add ink-spinner@^5.0.0
pnpm add -D ink-testing-library@^4.0.0
```

Expected: both install without peer-dependency errors against `ink@^5.0.1` / `react@^18.3.1`.

- [x] **Step 2: Write the failing tests**

Create `test/components/integration-tab.test.tsx`:

```tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { IntegrationTab, IntegrationService } from '../../src/components/IntegrationTab.js';
import { createConnectionStore } from '../../src/services/connectionStore.js';
import { createStubConnector } from '../../src/services/connectors.js';

const ARROW_UP = '\u001B[A';
const ARROW_DOWN = '\u001B[B';

const tick = (ms = 30) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function makeServices(delayMs = 10): IntegrationService[] {
  return [
    { id: 'lastfm', label: 'LastFm', connector: createStubConnector(delayMs) },
    { id: 'spotify', label: 'Spotify', connector: createStubConnector(delayMs) },
  ];
}

function rowFor(frame: string, label: string): string {
  const line = frame.split('\n').find((l) => l.includes(label));
  assert.ok(line !== undefined, `expected a row containing ${label}`);
  return line;
}

test('renders both services with Connect controls, first row focused', async () => {
  const { lastFrame, unmount } = render(
    <IntegrationTab services={makeServices()} store={createConnectionStore()} />,
  );
  await tick();

  const frame = lastFrame() ?? '';
  assert.ok(frame.includes('▸ LastFm'));
  assert.ok(frame.includes('Spotify'));
  assert.ok(rowFor(frame, 'LastFm').includes('Connect'));
  assert.ok(rowFor(frame, 'Spotify').includes('Connect'));
  unmount();
});

test('down/up arrows move focus and clamp at the ends', async () => {
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={makeServices()} store={createConnectionStore()} />,
  );
  await tick();

  stdin.write(ARROW_DOWN);
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ Spotify'));

  stdin.write(ARROW_DOWN); // already at the last row — clamps
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ Spotify'));

  stdin.write(ARROW_UP);
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ LastFm'));

  stdin.write(ARROW_UP); // already at the first row — clamps
  await tick();
  assert.ok((lastFrame() ?? '').includes('▸ LastFm'));
  unmount();
});

test('space toggles the focused row: connecting spinner, then Connected', async () => {
  const store = createConnectionStore();
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={makeServices(40)} store={store} />,
  );
  await tick();

  stdin.write(' ');
  await tick(10);
  assert.equal(store.getStatus('lastfm'), 'connecting');
  assert.ok(
    !rowFor(lastFrame() ?? '', 'LastFm').includes('Connect'),
    'connecting row shows a spinner instead of the Connect label',
  );

  await tick(60);
  assert.equal(store.getStatus('lastfm'), 'connected');
  assert.ok(rowFor(lastFrame() ?? '', 'LastFm').includes('Connected'));
  unmount();
});

test('enter toggles a connected row back through disconnecting to Connect', async () => {
  const store = createConnectionStore();
  const services = makeServices(40);
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={services} store={store} />,
  );
  await tick();

  stdin.write('\r');
  await tick(60);
  assert.equal(store.getStatus('lastfm'), 'connected');

  stdin.write('\r');
  await tick(10);
  assert.equal(store.getStatus('lastfm'), 'disconnecting');

  await tick(60);
  assert.equal(store.getStatus('lastfm'), 'disconnected');
  assert.ok(rowFor(lastFrame() ?? '', 'LastFm').includes('Connect'));
  unmount();
});

test('a failed connect shows the error state and the row still reads Connect', async () => {
  const store = createConnectionStore();
  const services: IntegrationService[] = [
    {
      id: 'lastfm',
      label: 'LastFm',
      connector: {
        connect: () => Promise.reject(new Error('nope')),
        disconnect: () => Promise.resolve(),
      },
    },
  ];
  const { stdin, lastFrame, unmount } = render(
    <IntegrationTab services={services} store={store} />,
  );
  await tick();

  stdin.write(' ');
  await tick();
  assert.equal(store.getStatus('lastfm'), 'error');
  assert.ok(rowFor(lastFrame() ?? '', 'LastFm').includes('Connect'));
  assert.ok(!rowFor(lastFrame() ?? '', 'LastFm').includes('Connected'));
  unmount();
});
```

- [x] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec tsx --test test/components/integration-tab.test.tsx`
Expected: FAIL — cannot find module `src/components/IntegrationTab.js`.

- [x] **Step 4: Write the implementation**

Create `src/components/IntegrationTab.tsx`:

```tsx
import React, { useEffect, useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { ServiceConnector, createStubConnector } from '../services/connectors.js';
import {
  ConnectionStatus,
  ConnectionStore,
  connectionStore,
} from '../services/connectionStore.js';

export interface IntegrationService {
  id: string;
  label: string;
  connector: ServiceConnector;
}

export const INTEGRATION_SERVICES: IntegrationService[] = [
  { id: 'lastfm', label: 'LastFm', connector: createStubConnector() },
  { id: 'spotify', label: 'Spotify', connector: createStubConnector() },
];

const LABEL_COLUMN_WIDTH = 16;

interface IntegrationTabProps {
  services?: IntegrationService[];
  store?: ConnectionStore;
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'connecting' || status === 'disconnecting') {
    return (
      <Text>
        <Spinner type="dots" />
      </Text>
    );
  }
  if (status === 'connected') {
    return <Text color="green">Connected</Text>;
  }
  if (status === 'error') {
    return <Text color="red">Connect</Text>;
  }
  return <Text>Connect</Text>;
}

export function IntegrationTab({
  services = INTEGRATION_SERVICES,
  store = connectionStore,
}: IntegrationTabProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => store.subscribe(forceRender), [store]);

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setFocusedIndex((i) => Math.min(services.length - 1, i + 1));
    } else if (key.return || input === ' ') {
      const service = services[focusedIndex];
      store.toggle(service.id, service.connector);
    }
  });

  return (
    <Box flexDirection="column">
      {services.map((service, index) => (
        <Box key={service.id}>
          <Box width={LABEL_COLUMN_WIDTH}>
            <Text color={index === focusedIndex ? 'cyan' : undefined}>
              {index === focusedIndex ? '▸ ' : '  '}
              {service.label}
            </Text>
          </Box>
          <StatusIndicator status={store.getStatus(service.id)} />
        </Box>
      ))}
    </Box>
  );
}
```

Notes for the implementer:
- The `useReducer` counter + `store.subscribe(forceRender)` effect is what re-renders the rows when the store changes from outside React (e.g. a promise settling). `subscribe` returns the unsubscribe function, which doubles as the effect cleanup.
- The fixed `LABEL_COLUMN_WIDTH` keeps the status column aligned without depending on terminal width (deterministic in tests).

- [x] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec tsx --test test/components/integration-tab.test.tsx`
Expected: PASS (5 tests).

- [x] **Step 6: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 7: Commit**

```bash
git add src/components/IntegrationTab.tsx test/components/integration-tab.test.tsx package.json pnpm-lock.yaml
git commit -m "feat: add IntegrationTab with row navigation and connect toggling"
```

---

### Task 4: ConnectScreen and OtherTab components

**Files:**
- Create: `src/components/OtherTab.tsx`
- Create: `src/components/ConnectScreen.tsx`
- Test: `test/components/connect-screen.test.tsx`

**Interfaces:**
- Consumes: `IntegrationTab` from `src/components/IntegrationTab.js` (Task 3, rendered with no props so it uses `INTEGRATION_SERVICES` + the singleton store).
- Produces: `OtherTab` component (no props); `ConnectScreen` component with props `{ onClose: () => void }` — this exact props shape is what `CommandResult.screen` (Task 5) and `App.tsx` (Task 6) type against.
- Keyboard: `Tab` toggles between the `integration` and `other` tabs; `Esc` calls `onClose`. Arrows/space/enter pass through to `IntegrationTab`'s own `useInput` when that tab is mounted (Ink delivers input to every mounted `useInput` hook; each hook ignores keys it doesn't handle).

- [x] **Step 1: Write the failing tests**

Create `test/components/connect-screen.test.tsx`:

```tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { ConnectScreen } from '../../src/components/ConnectScreen.js';

const ESC = '\u001B';
const TAB = '\t';

const tick = (ms = 30) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

test('renders title, tabs, integration rows, and the footer hint', async () => {
  const { lastFrame, unmount } = render(<ConnectScreen onClose={() => {}} />);
  await tick();

  const frame = lastFrame() ?? '';
  assert.ok(frame.includes('Settings'));
  assert.ok(frame.includes('Integration'));
  assert.ok(frame.includes('Other'));
  assert.ok(frame.includes('LastFm'));
  assert.ok(frame.includes('Spotify'));
  assert.ok(
    frame.includes('Esc to cancel · ↑/↓ to select · Space/Enter to toggle · Tab to switch tabs'),
  );
  unmount();
});

test('tab switches to the Other placeholder and back', async () => {
  const { stdin, lastFrame, unmount } = render(<ConnectScreen onClose={() => {}} />);
  await tick();

  stdin.write(TAB);
  await tick();
  const otherFrame = lastFrame() ?? '';
  assert.ok(otherFrame.includes('Nothing here yet.'));
  assert.ok(!otherFrame.includes('LastFm'));

  stdin.write(TAB);
  await tick();
  assert.ok((lastFrame() ?? '').includes('LastFm'));
  unmount();
});

test('escape calls onClose', async () => {
  let closed = 0;
  const { stdin, unmount } = render(
    <ConnectScreen
      onClose={() => {
        closed += 1;
      }}
    />,
  );
  await tick();

  stdin.write(ESC);
  await tick();
  assert.equal(closed, 1);
  unmount();
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec tsx --test test/components/connect-screen.test.tsx`
Expected: FAIL — cannot find module `src/components/ConnectScreen.js`.

- [x] **Step 3: Write the implementations**

Create `src/components/OtherTab.tsx`:

```tsx
import React from 'react';
import { Text } from 'ink';

export function OtherTab() {
  return <Text dimColor>Nothing here yet.</Text>;
}
```

Create `src/components/ConnectScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { IntegrationTab } from './IntegrationTab.js';
import { OtherTab } from './OtherTab.js';

type TabId = 'integration' | 'other';

interface ConnectScreenProps {
  onClose: () => void;
}

const FOOTER_HINT =
  'Esc to cancel · ↑/↓ to select · Space/Enter to toggle · Tab to switch tabs';

export function ConnectScreen({ onClose }: ConnectScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>('integration');

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
    } else if (key.tab) {
      setActiveTab((tab) => (tab === 'integration' ? 'other' : 'integration'));
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Settings</Text>
      <Box marginTop={1} gap={3}>
        <Text
          bold={activeTab === 'integration'}
          underline={activeTab === 'integration'}
        >
          Integration
        </Text>
        <Text bold={activeTab === 'other'} underline={activeTab === 'other'}>
          Other
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {activeTab === 'integration' ? <IntegrationTab /> : <OtherTab />}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{FOOTER_HINT}</Text>
      </Box>
    </Box>
  );
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec tsx --test test/components/connect-screen.test.tsx`
Expected: PASS (3 tests).

- [x] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 6: Commit**

```bash
git add src/components/ConnectScreen.tsx src/components/OtherTab.tsx test/components/connect-screen.test.tsx
git commit -m "feat: add ConnectScreen with Integration/Other tabs and escape-to-close"
```

---

### Task 5: `CommandResult.screen` seam and ConnectCommand

**Files:**
- Modify: `src/commands/Command.ts`
- Create: `src/commands/ConnectCommand.tsx`
- Modify: `src/commands/index.ts` (register the command)
- Test: `test/commands/connect.test.ts`
- Modify: `test/commands/registry.test.ts` (the `fuzzyMatch('')` registration-order assertion must now include `connect`)

**Interfaces:**
- Consumes: `ConnectScreen` from `src/components/ConnectScreen.js` (Task 4); existing `Command`/`CommandResult` from `src/commands/Command.js` and `CommandRegistry` from `src/commands/registry.js`.
- Produces: `CommandResult.screen?: ComponentType<{ onClose: () => void }>` — the new seam `App.tsx` consumes in Task 6; `ConnectCommand` class (`names = ['connect']`, `execute()` returns `{ output: '', screen: ConnectScreen }`) registered in `createCommandRegistry()` after `ExitCommand` and `EchoCommand`, so registration order is `['exit', 'echo', 'connect']`.

- [x] **Step 1: Write the failing tests**

Create `test/commands/connect.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommandRegistry } from '../../src/commands/index.js';
import { ConnectScreen } from '../../src/components/ConnectScreen.js';

test('dispatch runs /connect and returns the ConnectScreen with no output', async () => {
  const registry = createCommandRegistry();
  const result = await registry.dispatch('/connect');
  assert.equal(result.output, '');
  assert.equal(result.screen, ConnectScreen);
  assert.equal(result.exit, undefined);
});

test('/connect fuzzy-matches in the dropdown', () => {
  const registry = createCommandRegistry();
  const matches = registry.fuzzyMatch('con').map((c) => c.names[0]);
  assert.ok(matches.includes('connect'));
});
```

- [x] **Step 2: Update the registration-order assertion in the existing registry test**

In `test/commands/registry.test.ts`, the test `fuzzyMatch with an empty query returns all commands in registration order` currently asserts:

```ts
assert.deepEqual(names, ['exit', 'echo']);
```

Change it to:

```ts
assert.deepEqual(names, ['exit', 'echo', 'connect']);
```

- [x] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec tsx --test test/commands/connect.test.ts test/commands/registry.test.ts`
Expected: FAIL — `connect.test.ts` cannot find `src/commands/ConnectCommand`-provided registration (unknown command `/connect`), and the updated registration-order assertion fails.

- [x] **Step 4: Write the implementation**

Modify `src/commands/Command.ts` to add the `screen` field (full file):

```ts
import type { ComponentType, ReactNode } from 'react';

export interface CommandResult {
  output: string | ReactNode;
  exit?: boolean;
  screen?: ComponentType<{ onClose: () => void }>;
}

export interface Command {
  names: string[];
  description: string;
  execute(arg: string): CommandResult | Promise<CommandResult>;
}
```

Create `src/commands/ConnectCommand.tsx`:

```tsx
import { Command, CommandResult } from './Command.js';
import { ConnectScreen } from '../components/ConnectScreen.js';

export class ConnectCommand implements Command {
  names = ['connect'];
  description = 'Manage LastFm and Spotify integrations';

  execute(): CommandResult {
    return { output: '', screen: ConnectScreen };
  }
}
```

Modify `src/commands/index.ts` to register it (full file):

```ts
import { CommandRegistry } from './registry.js';
import { ExitCommand } from './ExitCommand.js';
import { EchoCommand } from './EchoCommand.js';
import { ConnectCommand } from './ConnectCommand.js';

export type CommandHandler = (input: string) => string | Promise<string>;

export const defaultHandler: CommandHandler = async (input) => {
  return `you typed: ${input}`;
};

export type { Command, CommandResult } from './Command.js';
export { CommandRegistry } from './registry.js';

export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry([new ExitCommand(), new EchoCommand(), new ConnectCommand()]);
}
```

- [x] **Step 5: Run the full test suite to verify it passes**

Run: `pnpm test`
Expected: PASS — including the two new connect tests and the updated registry-order test; no regressions in echo/prompt-input/services/component tests.

- [x] **Step 6: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 7: Commit**

```bash
git add src/commands/Command.ts src/commands/ConnectCommand.tsx src/commands/index.ts test/commands/connect.test.ts test/commands/registry.test.ts
git commit -m "feat: add CommandResult.screen seam and register /connect"
```

---

### Task 6: App live-region swap

**Files:**
- Modify: `src/App.tsx`
- Test: `test/components/app.test.tsx`

**Interfaces:**
- Consumes: `CommandResult.screen` (Task 5); `PromptInput`, `Scrollback` unchanged.
- Produces: `App` renders the active screen in place of `PromptInput` when a dispatched command's result includes `screen`; the screen's `onClose` resets it back to the prompt. `<Static items={history}>` stays mounted throughout — only the live region below it swaps (Global Constraints).

- [x] **Step 1: Write the failing test**

Create `test/components/app.test.tsx`:

```tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { defaultHandler } from '../../src/commands/index.js';

const ESC = '\u001B';

const tick = (ms = 60) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

test('/connect opens the Settings screen and Esc returns to the prompt', async () => {
  const { stdin, lastFrame, unmount } = render(<App handler={defaultHandler} />);
  await tick();

  stdin.write('/connect');
  await tick();
  stdin.write('\r');
  await tick();

  const settingsFrame = lastFrame() ?? '';
  assert.ok(settingsFrame.includes('Settings'), 'screen replaces the prompt');
  assert.ok(settingsFrame.includes('LastFm'));
  assert.ok(settingsFrame.includes('Esc to cancel'));

  stdin.write(ESC);
  await tick();

  const promptFrame = lastFrame() ?? '';
  assert.ok(!promptFrame.includes('Settings'), 'Esc closes the screen');
  unmount();
});
```

Note: typing `/connect` makes the command dropdown appear; pressing Enter resolves through the dropdown's focused match, which dispatches `/connect` — that is the normal submit path and needs no special handling in the test.

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test test/components/app.test.tsx`
Expected: FAIL — the `Settings` assertion fails because `App` ignores `result.screen` (the prompt stays rendered).

- [x] **Step 3: Write the implementation**

Replace `src/App.tsx` with:

```tsx
import React, { ComponentType, useEffect, useMemo, useState } from 'react';
import { Box, Static, useApp, useInput, useStdout } from 'ink';
import { Scrollback, HistoryEntry } from './components/Scrollback.js';
import { PromptInput } from './components/PromptInput.js';
import { CommandHandler, CommandResult, createCommandRegistry } from './commands/index.js';

const EXIT_RENDER_DELAY_MS = 50;

type ScreenComponent = ComponentType<{ onClose: () => void }>;

interface AppProps {
  handler: CommandHandler;
}

export function App({ handler }: AppProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isExiting, setIsExiting] = useState(false);
  const [activeScreen, setActiveScreen] = useState<ScreenComponent | null>(null);
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
        if (result.screen) {
          const screen = result.screen;
          setActiveScreen(() => screen);
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

  const ActiveScreen = activeScreen;

  return (
    <Box flexDirection="column">
      <Static items={history}>
        {(entry, i) => <Scrollback key={i} entry={entry} />}
      </Static>
      {ActiveScreen ? (
        <ActiveScreen onClose={() => setActiveScreen(null)} />
      ) : (
        <PromptInput
          isFocused={!isExiting}
          onSubmit={handleSubmit}
          registry={commandRegistry}
        />
      )}
    </Box>
  );
}
```

Notes for the implementer:
- `setActiveScreen(() => screen)` must use the updater-function form: React treats a bare function argument to a state setter as an updater and would *call* the component instead of storing it.
- The `<Static>` block is byte-for-byte unchanged and stays mounted whether or not a screen is active.
- Command dispatch errors still land in the existing `catch` → `Error: ...` scrollback path; nothing changes there.
- `App`'s own `useInput` (Ctrl+C) stays active while a screen is open — Ink delivers input to all mounted `useInput` hooks — so Ctrl+C still exits immediately.

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm exec tsx --test test/components/app.test.tsx`
Expected: PASS.

- [x] **Step 5: Run the full suite and type-check**

Run: `pnpm test`
Expected: all tests pass.

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

- [x] **Step 6: Commit**

```bash
git add src/App.tsx test/components/app.test.tsx
git commit -m "feat: swap the live region to a command's screen and back on close"
```

---

### Task 7: Full verification and manual smoke test

**Files:** none (verification only)

- [x] **Step 1: Full automated verification**

Run: `pnpm test`
Expected: all tests pass (commands, components, services).

Run: `pnpm exec tsc --noEmit`
Expected: exits with no output and status 0.

Run: `pnpm build`
Expected: completes without errors; `dist/cli.js` exists and is executable.

- [x] **Step 2: Manual smoke test**

Run: `pnpm dev`, then in the running terminal:

1. Type `/connect` and press Enter.
   Expected: the bordered Settings screen replaces the prompt box; the cyan `> /connect` line remains in the scrollback above it; `Integration` is the active tab; `▸ LastFm` is focused; both rows show `Connect`; the footer reads `Esc to cancel · ↑/↓ to select · Space/Enter to toggle · Tab to switch tabs`.
2. Press `↓` then `↑`.
   Expected: the `▸` marker moves to Spotify, then back to LastFm; pressing `↑` again does nothing (clamped).
3. Press `Space` on LastFm.
   Expected: a spinner replaces `Connect` for roughly 800ms, then a green `Connected` appears.
4. Press `Enter` on LastFm again.
   Expected: spinner (disconnecting), then back to `Connect`.
5. Press `Tab`.
   Expected: the `Other` tab activates and shows `Nothing here yet.`; `Tab` again returns to `Integration`.
6. Press `Space` on Spotify, then immediately press `Esc` before the spinner finishes.
   Expected: the screen closes back to the prompt. Type `/connect` and Enter again — Spotify shows `Connected` (the in-flight connect kept running in the background).
7. Press `Esc`, type `hello`, press Enter.
   Expected: normal echo behavior (`you typed: hello`) — the prompt path is unaffected.
8. Reopen `/connect` and press `Ctrl+C` while the screen is open.
   Expected: the app exits cleanly, no hang, no stack trace.

- [x] **Step 3: Fix-forward if needed**

No source changes expected in this task — nothing to commit. If the smoke test surfaces a bug, fix it in the relevant task's file, re-run that task's tests plus `pnpm test` and `pnpm exec tsc --noEmit`, and commit the fix with an appropriate message before continuing.

- [x] **Step 4: Close out the plan**

Per `CLAUDE.md`: check off every completed step in this plan file and add a `**Status: Completed.**` line under the title noting the commit range, then commit the plan update.
