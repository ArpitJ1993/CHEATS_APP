import React, { Component, ReactNode } from 'react';
import styled from '@emotion/styled';
import { Button } from '../core-components/Button';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: var(--spacing-xl);
  text-align: center;
  background-color: var(--color-background);
`;

const ErrorTitle = styled.h1`
  color: var(--color-error);
  margin-bottom: var(--spacing-md);
`;

const ErrorMessage = styled.p`
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
  max-width: 600px;
`;

const ErrorDetails = styled.pre`
  background-color: var(--color-surface);
  padding: var(--spacing-md);
  border-radius: 8px;
  color: var(--color-text);
  font-size: var(--font-size-small);
  text-align: left;
  max-width: 800px;
  overflow-x: auto;
  margin-bottom: var(--spacing-lg);
`;

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    // Example: errorReportingService.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorContainer>
          <ErrorTitle>Something went wrong</ErrorTitle>
          <ErrorMessage>
            We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
          </ErrorMessage>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <ErrorDetails>
              <strong>Error:</strong> {this.state.error.toString()}
              {this.state.errorInfo && (
                <>
                  {'\n\n'}
                  <strong>Component Stack:</strong>
                  {'\n'}
                  {this.state.errorInfo.componentStack}
                </>
              )}
            </ErrorDetails>
          )}
          
          <Button variant="primary" onClick={this.handleReset}>
            Try Again
          </Button>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}
