import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { Button } from '../core-components/Button';
import { AppVisibility } from '../enums';
import { setVisibility } from '../slices/appSlice';

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
`;

const ToggleButton = styled(Button, { shouldForwardProp: (prop) => prop !== 'isHidden' })<{ isHidden: boolean }>`
  ${({ isHidden }) => isHidden && `
    background-color: var(--color-warning);
    color: white;
    
    &:hover {
      background-color: color-mix(in srgb, var(--color-warning) 85%, black);
    }
  `}
`;

const StatusIndicator = styled.div<{ isHidden: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${({ isHidden }) => 
    isHidden ? 'var(--color-warning)' : 'var(--color-success)'
  };
`;

const StatusText = styled.span`
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
`;

export const VisibilityToggle: React.FC = () => {
  const dispatch = useDispatch();
  const { visibility } = useSelector((state: RootState) => state.app);
  const [isLoading, setIsLoading] = useState(false);
  
  
  const isHidden = visibility === AppVisibility.HIDDEN;

  const handleToggle = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      let result;
      if (isHidden) {
        // Show app
        if (window.electronAPI) {
          result = await window.electronAPI.manualShowApp();
          dispatch(setVisibility(AppVisibility.VISIBLE));
        }
      } else {
        // Hide app
        if (window.electronAPI) {
          result = await window.electronAPI.manualHideApp();
          dispatch(setVisibility(AppVisibility.HIDDEN));
        }
      }
    } catch (error) {
      console.error('Toggle error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep button state in sync with global shortcuts and main-process changes
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const status = await (window as any)?.electronAPI?.getAppVisibilityStatus?.();
        if (status) {
          dispatch(setVisibility(status.isManuallyHidden ? AppVisibility.HIDDEN : AppVisibility.VISIBLE));
        }
      } catch {}
    };
    bootstrap();
    (window as any)?.electronAPI?.onVisibilityStatus?.((payload: any) => {
      if (payload && typeof payload.isManuallyHidden === 'boolean') {
        dispatch(setVisibility(payload.isManuallyHidden ? AppVisibility.HIDDEN : AppVisibility.VISIBLE));
      }
    });
    return () => {
      (window as any)?.electronAPI?.removeVisibilityStatusListener?.();
    };
  }, [dispatch]);

  // Window hide/show handled via global keyboard shortcuts only

  return (
    <ToggleContainer>
      <StatusIndicator isHidden={isHidden} />
      <ToggleButton
        variant={isHidden ? 'primary' : 'outlined'}
        size="small"
        onClick={handleToggle}
        isHidden={isHidden}
        disabled={isLoading}
      >
        {isLoading ? '...' : (isHidden ? 'Show App' : 'Hide App')}
      </ToggleButton>
      <StatusText>
        {isHidden ? 'Hidden from screen share' : 'Visible to screen share'}
      </StatusText>
    </ToggleContainer>
  );
};
