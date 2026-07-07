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
