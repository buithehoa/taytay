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
