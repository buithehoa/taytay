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
      <Box borderStyle="round" borderLeft={false} borderRight={false} paddingX={1}>
        <PromptInput onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
