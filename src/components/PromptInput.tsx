import React, { useState } from 'react';
import TextInput from 'ink-text-input';

interface PromptInputProps {
  onSubmit: (value: string) => void;
}

export function PromptInput({ onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (submitted: string) => {
    setValue('');
    onSubmit(submitted);
  };

  return <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />;
}
