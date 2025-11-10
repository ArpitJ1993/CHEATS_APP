import React from 'react';
import styled from '@emotion/styled';
import { AppError } from '../types';
import { ErrorType as ErrorTypeEnum } from '../enums';

const ErrorContainer = styled.div<{ type: string }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid;
  background-color: var(--color-surface);
  margin: 8px 0;

  ${({ type }) => {
    switch (type) {
      case ErrorTypeEnum.ERROR:
        return `
          border-left-color: var(--color-error);
          background-color: color-mix(in srgb, var(--color-error) 10%, var(--color-surface));
        `;
      case ErrorTypeEnum.WARNING:
        return `
          border-left-color: var(--color-warning);
          background-color: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
        `;
      case ErrorTypeEnum.INFO:
        return `
          border-left-color: var(--color-info);
          background-color: color-mix(in srgb, var(--color-info) 10%, var(--color-surface));
        `;
      default:
        return `
          border-left-color: var(--color-error);
          background-color: color-mix(in srgb, var(--color-error) 10%, var(--color-surface));
        `;
    }
  }}
`;

const ErrorIcon = styled.div<{ type: string }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;

  ${({ type }) => {
    switch (type) {
      case ErrorTypeEnum.ERROR:
        return `
          background-color: var(--color-error);
          color: white;
        `;
      case ErrorTypeEnum.WARNING:
        return `
          background-color: var(--color-warning);
          color: white;
        `;
      case ErrorTypeEnum.INFO:
        return `
          background-color: var(--color-info);
          color: white;
        `;
      default:
        return `
          background-color: var(--color-error);
          color: white;
        `;
    }
  }}
`;

const ErrorContent = styled.div`
  flex: 1;
`;

const ErrorMessageText = styled.p`
  margin: 0 0 8px 0;
  color: var(--color-text);
  font-size: var(--font-size-medium);
  font-weight: 500;
`;

const ErrorDetails = styled.p`
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.4;
`;

const RetryButton = styled.button`
  margin-top: 12px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: #1976d2;
  color: white;
  cursor: default;
  font-weight: 600;
`;

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss
}) => {
  const getErrorIcon = (type: string) => {
    switch (type) {
      case ErrorTypeEnum.ERROR:
        return '!';
      case ErrorTypeEnum.WARNING:
        return '⚠';
      case ErrorTypeEnum.INFO:
        return 'i';
      default:
        return '!';
    }
  };

  const getErrorTitle = (type: string) => {
    switch (type) {
      case ErrorTypeEnum.API:
        return 'API Error';
      case ErrorTypeEnum.NETWORK:
        return 'Network Error';
      case ErrorTypeEnum.PERMISSION:
        return 'Permission Error';
      case ErrorTypeEnum.VALIDATION:
        return 'Validation Error';
      case ErrorTypeEnum.SYSTEM:
        return 'System Error';
      default:
        return 'Error';
    }
  };

  return (
    <ErrorContainer type={error.type}>
      <ErrorIcon type={error.type}>
        {getErrorIcon(error.type)}
      </ErrorIcon>
      <ErrorContent>
        <ErrorMessageText>{getErrorTitle(error.type)}: {error.message}</ErrorMessageText>
        {error.details && (
          <ErrorDetails>{JSON.stringify(error.details)}</ErrorDetails>
        )}
        {onRetry && (
          <RetryButton onClick={onRetry}>
            Try Again
          </RetryButton>
        )}
      </ErrorContent>
    </ErrorContainer>
  );
};

// Simple error message component
export const ErrorMessage: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry
}) => (
  <ErrorContainer type={ErrorTypeEnum.ERROR}>
    <ErrorIcon type={ErrorTypeEnum.ERROR}>!</ErrorIcon>
    <ErrorContent>
      <ErrorMessageText>{message}</ErrorMessageText>
      {onRetry && (
        <RetryButton onClick={onRetry}>
          Try Again
        </RetryButton>
      )}
    </ErrorContent>
  </ErrorContainer>
);
