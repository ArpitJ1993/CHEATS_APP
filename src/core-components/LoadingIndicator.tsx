import React from 'react';
import styled from '@emotion/styled';
import { LoadingState } from '../types';

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: var(--color-text-secondary);
  font-size: var(--font-size-medium);
  margin: 0;
  text-align: center;
`;

const ProgressBar = styled.div<{ progress: number }>`
  width: 200px;
  height: 4px;
  background-color: var(--color-border);
  border-radius: 2px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${({ progress }) => progress}%;
    height: 100%;
    background-color: var(--color-primary);
    transition: width 0.3s ease-in-out;
  }
`;

interface LoadingIndicatorProps {
  loading: boolean;
  message?: string;
  progress?: number;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  loading,
  message = 'Loading...',
  progress,
  size = 'medium'
}) => {
  if (!loading) return null;

  const spinnerSize = size === 'small' ? '24px' : size === 'large' ? '56px' : '40px';

  return (
    <LoadingContainer>
      <Spinner style={{ width: spinnerSize, height: spinnerSize }} />
      <LoadingText>{message}</LoadingText>
      {progress !== undefined && (
        <ProgressBar progress={progress} />
      )}
    </LoadingContainer>
  );
};

// Inline loading spinner for buttons and small components
export const InlineSpinner: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <Spinner style={{ width: size, height: size, borderWidth: '2px' }} />
);

// Loading overlay for full-screen loading
export const LoadingOverlay: React.FC<LoadingIndicatorProps> = (props) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  }}>
    <LoadingIndicator {...props} />
  </div>
);
