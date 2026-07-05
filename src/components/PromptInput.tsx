import React, { useState } from 'react';
import TextInput from 'ink-text-input';

interface PromptInputProps {
  isFocused?: boolean;
  onSubmit: (value: string) => boolean | void;
}

export function PromptInput({ isFocused = true, onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (submitted: string) => {
    const shouldClear = onSubmit(submitted);
    if (shouldClear !== false) {
      setValue('');
    }
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
