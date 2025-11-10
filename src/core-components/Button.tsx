import React from 'react';
import styled from '@emotion/styled';
import { ButtonProps } from '../types';
import { ButtonVariant as ButtonVariantEnum, ButtonSize as ButtonSizeEnum } from '../enums';

const StyledButton = styled.button<{
  variant: string;
  size: string;
  disabled: boolean;
  loading: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 8px;
  font-family: var(--font-family);
  font-weight: 500;
  cursor: default;
  transition: all 0.2s ease-in-out;
  position: relative;
  overflow: hidden;

  /* Size variants */
  ${({ size }) => {
    switch (size) {
      case ButtonSizeEnum.SMALL:
        return `
          padding: 6px 12px;
          font-size: var(--font-size-small);
          min-height: 32px;
        `;
      case ButtonSizeEnum.LARGE:
        return `
          padding: 12px 24px;
          font-size: var(--font-size-large);
          min-height: 48px;
        `;
      default:
        return `
          padding: 8px 16px;
          font-size: var(--font-size-medium);
          min-height: 40px;
        `;
    }
  }}

  /* Color variants */
  ${({ variant }) => {
    switch (variant) {
      case ButtonVariantEnum.PRIMARY:
        return `
          background-color: var(--color-primary);
          color: white;
          &:hover:not(:disabled) {
            background-color: color-mix(in srgb, var(--color-primary) 85%, black);
          }
        `;
      case ButtonVariantEnum.SECONDARY:
        return `
          background-color: var(--color-secondary);
          color: white;
          &:hover:not(:disabled) {
            background-color: color-mix(in srgb, var(--color-secondary) 85%, black);
          }
        `;
      case ButtonVariantEnum.OUTLINED:
        return `
          background-color: transparent;
          color: var(--color-primary);
          border: 1px solid var(--color-primary);
          &:hover:not(:disabled) {
            background-color: var(--color-primary);
            color: white;
          }
        `;
      case ButtonVariantEnum.TEXT:
        return `
          background-color: transparent;
          color: var(--color-primary);
          &:hover:not(:disabled) {
            background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
          }
        `;
      default:
        return '';
    }
  }}

  /* Disabled state */
  ${({ disabled }) => disabled && `
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  `}

  /* Loading state */
  ${({ loading }) => loading && `
    cursor: wait;
    pointer-events: none;
  `}

  /* Focus state */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Active state */
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export const Button: React.FC<ButtonProps> = ({
  variant = ButtonVariantEnum.PRIMARY,
  size = ButtonSizeEnum.MEDIUM,
  disabled = false,
  loading = false,
  onClick,
  children,
  className,
  ...props
}) => {
  // Filter out custom props that shouldn't be passed to the native button
  const { variant: _, size: __, loading: ___, ...nativeProps } = props as any;
  
  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled || loading}
      loading={loading}
      onClick={onClick}
      className={className}
      {...nativeProps}
    >
      {loading && <LoadingSpinner />}
      {children}
    </StyledButton>
  );
};
