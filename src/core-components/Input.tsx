import React from 'react';
import styled from '@emotion/styled';
import { InputProps } from '../types';

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
`;

const StyledInput = styled.input<{ error?: string; multiline?: boolean }>`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid ${({ error }) => error ? 'var(--color-error)' : 'var(--color-border)'};
  border-radius: 8px;
  font-family: var(--font-family);
  font-size: var(--font-size-medium);
  background-color: var(--color-background);
  color: var(--color-text);
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: var(--color-surface);
  }

  &::placeholder {
    color: var(--color-text-secondary);
  }
`;

const StyledTextArea = styled.textarea<{ error?: string }>`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid ${({ error }) => error ? 'var(--color-error)' : 'var(--color-border)'};
  border-radius: 8px;
  font-family: var(--font-family);
  font-size: var(--font-size-medium);
  background-color: var(--color-background);
  color: var(--color-text);
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: var(--color-surface);
  }

  &::placeholder {
    color: var(--color-text-secondary);
  }
`;

const ErrorText = styled.span`
  color: var(--color-error);
  font-size: var(--font-size-small);
  margin-top: 4px;
`;

const Label = styled.label`
  color: var(--color-text);
  font-size: var(--font-size-medium);
  font-weight: 500;
`;

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  multiline = false,
  rows = 4,
  className,
  type,
  min,
  max,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <InputContainer className={className}>
      {multiline ? (
        <StyledTextArea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          rows={rows}
          {...props}
        />
      ) : (
        <StyledInput
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          type={type}
          min={min}
          max={max}
          {...props}
        />
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </InputContainer>
  );
};
