import React, { useEffect, useState } from 'react';
import { Box, Static, useApp, useInput, useStdout } from 'ink';
import { Scrollback, HistoryEntry } from './components/Scrollback.js';
import { PromptInput } from './components/PromptInput.js';
import { CommandHandler } from './commands/index.js';

const EXIT_RENDER_DELAY_MS = 50;

interface AppProps {
  handler: CommandHandler;
}

export function App({ handler }: AppProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isExiting, setIsExiting] = useState(false);
  const { exit } = useApp();
  const { write } = useStdout();

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

    if (trimmed === 'exit' || trimmed === 'quit') {
      setIsExiting(true);
      return false;
    }

    setHistory((h) => [...h, { type: 'input', text: trimmed }]);

    void (async () => {
      try {
        const result = await handler(trimmed);
        setHistory((h) => [...h, { type: 'output', text: result }]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setHistory((h) => [...h, { type: 'output', text: `Error: ${message}` }]);
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
