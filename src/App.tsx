import React, { ComponentType, useEffect, useMemo, useState } from 'react';
import { Box, Static, useApp, useInput } from 'ink';
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
  const commandRegistry = useMemo(() => createCommandRegistry(), []);

  useEffect(() => {
    if (isExiting) {
      const timeout = setTimeout(() => {
        exit();
      }, EXIT_RENDER_DELAY_MS);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [exit, isExiting]);

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
      ) : !isExiting ? (
        <PromptInput
          isFocused
          onSubmit={handleSubmit}
          registry={commandRegistry}
        />
      ) : null}
    </Box>
  );
}
