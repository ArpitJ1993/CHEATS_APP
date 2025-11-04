import React, { useEffect } from 'react';
import styled from '@emotion/styled';
import { Button } from '../core-components/Button';
import { ErrorDisplay } from '../core-components/ErrorDisplay';
import { AppError } from '../types';

const Container = styled.div`
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-md);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-width: 400px;
`;

const NotificationItem = styled.div<{ type: string }>`
  padding: var(--spacing-md);
  border-radius: 8px;
  border-left: 4px solid;
  background-color: var(--color-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  ${({ type }) => {
    switch (type) {
      case 'success':
        return `
          border-left-color: var(--color-success);
          background-color: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
        `;
      case 'error':
        return `
          border-left-color: var(--color-error);
          background-color: color-mix(in srgb, var(--color-error) 10%, var(--color-surface));
        `;
      case 'warning':
        return `
          border-left-color: var(--color-warning);
          background-color: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
        `;
      case 'info':
        return `
          border-left-color: var(--color-info);
          background-color: color-mix(in srgb, var(--color-info) 10%, var(--color-surface));
        `;
      default:
        return `
          border-left-color: var(--color-border);
        `;
    }
  }}
`;

const NotificationContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-sm);
`;

const NotificationText = styled.div`
  flex: 1;
`;

const NotificationTitle = styled.div`
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
`;

const NotificationMessage = styled.div`
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  
  &:hover {
    background-color: var(--color-border);
  }
`;

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
}

interface NotificationContainerProps {
  notifications: Notification[];
  onRemove?: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemove
}) => {
  const handleRemove = (id: string) => {
    onRemove?.(id);
  };

  // Auto-dismiss notifications after 2 seconds
  useEffect(() => {
    notifications.forEach((notification) => {
      const timer = setTimeout(() => {
        handleRemove(notification.id);
      }, 2000); // 2 seconds

      return () => clearTimeout(timer);
    });
  }, [notifications]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Container>
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} type={notification.type}>
          <NotificationContent>
            <NotificationText>
              <NotificationTitle>
                {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
              </NotificationTitle>
              <NotificationMessage>
                {notification.message}
              </NotificationMessage>
            </NotificationText>
            <CloseButton onClick={() => handleRemove(notification.id)}>
              ×
            </CloseButton>
          </NotificationContent>
        </NotificationItem>
      ))}
    </Container>
  );
};
