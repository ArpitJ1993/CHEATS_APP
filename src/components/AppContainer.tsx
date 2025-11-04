import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from '@emotion/styled';
import { RootState } from '../store';
import { MainInterface } from './MainInterface';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { MeetingsPage } from './MeetingsPage';
import { NotificationContainer } from './NotificationContainer';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingOverlay } from '../core-components/LoadingIndicator';
import { removeNotification } from '../slices/appSlice';

const AppWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-family);
  overflow: hidden;
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding-top: 40px;
  padding-bottom: 40px;
  padding-left: var(--spacing-md);
  padding-right: var(--spacing-md);
`;

const Sidebar = styled.div<{ isOpen: boolean }>`
  width: ${({ isOpen }) => isOpen ? '300px' : '0'};
  background-color: var(--color-surface);
  border-left: 1px solid var(--color-border);
  transition: width 0.3s ease-in-out;
  overflow: hidden;
`;

export const AppContainer: React.FC = () => {
  const dispatch = useDispatch();
  const { currentView, isLoading, loadingMessage } = useSelector((state: RootState) => state.app);
  const { notifications } = useSelector((state: RootState) => state.app);

  const handleRemoveNotification = (id: string) => {
    dispatch(removeNotification(id));
  };

  const renderContent = () => {
    switch (currentView) {
      case 'settings':
        return <SettingsPanel />;
      case 'history':
        return <HistoryPanel />;
      case 'meetings':
        return <MeetingsPage />;
      default:
        return <MainInterface />;
    }
  };

  return (
    <ErrorBoundary>
      <AppWrapper>
        <MainContent>
          {renderContent()}
        </MainContent>
        
        <Sidebar isOpen={currentView === 'history'}>
          {currentView === 'history' && <HistoryPanel />}
        </Sidebar>

        <NotificationContainer 
          notifications={notifications} 
          onRemove={handleRemoveNotification}
        />
        
        {isLoading && (
          <LoadingOverlay 
            loading={isLoading} 
            message={loadingMessage}
          />
        )}
      </AppWrapper>
    </ErrorBoundary>
  );
};
