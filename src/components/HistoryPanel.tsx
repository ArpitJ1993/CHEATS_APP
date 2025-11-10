import React from 'react';
import styled from '@emotion/styled';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Button } from '../core-components/Button';
import { Conversation } from '../types';
import { formatTimestamp } from '../utils';

const HistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--spacing-md);
  gap: var(--spacing-md);
  overflow-y: auto;
`;

const HistoryTitle = styled.h2`
  margin: 0;
  font-size: var(--font-size-large);
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-sm);
`;

const ConversationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

const ConversationItem = styled.div`
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-surface);
  cursor: default;
  transition: all 0.2s ease-in-out;
  
  &:hover {
    border-color: var(--color-primary);
    background-color: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
  }
`;

const ConversationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
`;

const ConversationDate = styled.div`
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
`;

const ConversationStats = styled.div`
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
`;

const ConversationPreview = styled.div`
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  line-height: 1.4;
  max-height: 3em;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-secondary);
  text-align: center;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
`;

export const HistoryPanel: React.FC = () => {
  const { conversations } = useSelector((state: RootState) => state.conversations);

  const handleConversationClick = (conversationId: string) => {
    // Load conversation logic would go here
  };

  const handleExportAll = () => {
    // Export all conversations logic would go here
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all conversation history?')) {
      // Clear history logic would go here
    }
  };

  if (conversations.length === 0) {
    return (
      <HistoryContainer>
        <HistoryTitle>Conversation History</HistoryTitle>
        <EmptyState>
          <h3>No conversations yet</h3>
          <p>Your conversation history will appear here</p>
        </EmptyState>
      </HistoryContainer>
    );
  }

  return (
    <HistoryContainer>
      <HistoryTitle>Conversation History ({conversations.length})</HistoryTitle>
      
      <ConversationList>
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            onClick={() => handleConversationClick(conversation.id)}
          >
            <ConversationHeader>
              <ConversationDate>
                {formatTimestamp(conversation.timestamp)}
              </ConversationDate>
              <ConversationStats>
                {conversation.queries.length} queries, {conversation.responses.length} responses
              </ConversationStats>
            </ConversationHeader>
            
            {conversation.queries.length > 0 && (
              <ConversationPreview>
                <strong>Last Query:</strong> {conversation.queries[conversation.queries.length - 1].text}
              </ConversationPreview>
            )}
          </ConversationItem>
        ))}
      </ConversationList>

      <ActionButtons>
        <Button variant="outlined" onClick={handleExportAll}>
          Export All
        </Button>
        <Button variant="outlined" onClick={handleClearHistory}>
          Clear History
        </Button>
      </ActionButtons>
    </HistoryContainer>
  );
};
