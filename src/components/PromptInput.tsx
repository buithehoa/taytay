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
