import React from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { DarkMode, LightMode, AutoMode } from '@mui/icons-material';
import { RootState } from '../store';
import { toggleTheme, setThemeMode } from '../slices/themeSlice';
import { ThemeMode } from '../enums';

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-surface);
  border-radius: 8px;
  padding: 4px;
  border: 1px solid var(--color-border);
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: default;
  color: var(--color-text);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  
  &:hover {
    background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-surface)')};
    color: var(--color-text);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
`;

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const dispatch = useDispatch();
  const themeMode = useSelector((state: RootState) => state.theme.mode);

  const handleThemeChange = (mode: ThemeMode) => {
    dispatch(setThemeMode(mode));
  };

  const handleToggle = () => {
    dispatch(toggleTheme());
  };

  return (
    <ToggleContainer className={className}>
      <ToggleButton
        $active={themeMode === ThemeMode.LIGHT}
        onClick={() => handleThemeChange(ThemeMode.LIGHT)}
        title="Light Mode"
      >
        <IconWrapper>
          <LightMode fontSize="small" />
        </IconWrapper>
      </ToggleButton>
      
      <ToggleButton
        $active={themeMode === ThemeMode.DARK}
        onClick={() => handleThemeChange(ThemeMode.DARK)}
        title="Dark Mode"
      >
        <IconWrapper>
          <DarkMode fontSize="small" />
        </IconWrapper>
      </ToggleButton>
      
      <ToggleButton
        $active={themeMode === ThemeMode.AUTO}
        onClick={() => handleThemeChange(ThemeMode.AUTO)}
        title="Auto Mode (Follow System)"
      >
        <IconWrapper>
          <AutoMode fontSize="small" />
        </IconWrapper>
      </ToggleButton>
    </ToggleContainer>
  );
};

export default ThemeToggle;
