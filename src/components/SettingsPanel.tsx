import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { Button } from '../core-components/Button';
import { Input } from '../core-components/Input';
import { 
  setTheme, 
  setFontSize, 
  setApiKey, 
  setMaxScreenshots, 
  setAutoSave,
  setSaveLocation,
  updateShortcut,
  resetSettings,
  updateSettings
} from '../slices/settingsSlice';
import { ThemeMode } from '../enums';
import { useDispatch as useAppDispatch } from 'react-redux';
import { setCurrentView } from '../slices/appSlice';

const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--spacing-md);
  gap: var(--spacing-lg);
  overflow-y: auto;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: var(--font-size-large);
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-sm);
`;

const SettingGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

const SettingLabel = styled.label`
  font-size: var(--font-size-medium);
  font-weight: 500;
  color: var(--color-text);
`;

const SettingDescription = styled.p`
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
`;

const Select = styled.select`
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-family);
  font-size: var(--font-size-medium);
  
  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
`;

export const SettingsPanel: React.FC = () => {
  const dispatch = useDispatch();
  const { settings } = useSelector((state: RootState) => state.settings);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // On mount, if we already have a key in settings, push it to main once
  useEffect(() => {
    const maybePushKey = async () => {
      try {
        const existing = (window as any)?.electronAPI?.getApiKey?.();
        if (settings.apiKey && settings.apiKey !== existing) {
          await (window as any)?.electronAPI?.setApiKey?.(settings.apiKey);
        }
      } catch {}
    };
    maybePushKey();
  }, [settings.apiKey]);

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    dispatch(setTheme(theme));
  };

  const handleFontSizeChange = (fontSize: 'small' | 'medium' | 'large') => {
    dispatch(setFontSize(fontSize));
  };

  const handleApiKeyChange = (apiKey: string) => {
    dispatch(setApiKey(apiKey));
  };

  const handleSaveApiKey = async () => {
    try {
      setSaveStatus('');
      if (!(window as any)?.electronAPI?.setApiKey) {
        setSaveStatus('Electron API unavailable.');
        return;
      }
      await (window as any).electronAPI.setApiKey(settings.apiKey);
      setSaveStatus('API key saved.');
      // Optional: brief clear
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e: any) {
      setSaveStatus(e?.message || 'Failed to save key');
    }
  };

  const handleMaxScreenshotsChange = (maxScreenshots: number) => {
    dispatch(setMaxScreenshots(maxScreenshots));
  };

  const handleAutoSaveChange = (autoSave: boolean) => {
    dispatch(setAutoSave(autoSave));
  };

  const handleSaveLocationChange = (saveLocation: string) => {
    dispatch(setSaveLocation(saveLocation));
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      dispatch(resetSettings());
    }
  };

  return (
    <SettingsContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>Settings</SectionTitle>
        <Button variant="outlined" onClick={() => (dispatch as any)(setCurrentView('main'))}>⬅ Back</Button>
      </div>
      <Section>
        <SectionTitle>Appearance</SectionTitle>
        
        <SettingGroup>
          <SettingLabel>Theme</SettingLabel>
          <Select
            value={settings.theme}
            onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark' | 'auto')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto (System)</option>
          </Select>
          <SettingDescription>
            Choose your preferred color theme
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Font Size</SettingLabel>
          <Select
            value={settings.fontSize}
            onChange={(e) => handleFontSizeChange(e.target.value as 'small' | 'medium' | 'large')}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </Select>
          <SettingDescription>
            Adjust the text size for better readability
          </SettingDescription>
        </SettingGroup>
      </Section>

      <Section>
        <SectionTitle>API Configuration</SectionTitle>
        
        <SettingGroup>
          <SettingLabel>OpenAI API Key</SettingLabel>
          <Input
            value={settings.apiKey}
            onChange={handleApiKeyChange}
            placeholder="sk-..."
            type="password"
          />
          <SettingDescription>
            Your OpenAI API key for AI responses
          </SettingDescription>
          <div>
            <Button variant="primary" onClick={handleSaveApiKey}>Save API Key</Button>
            {saveStatus && (
              <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)', fontSize: '0.9em' }}>{saveStatus}</span>
            )}
          </div>
        </SettingGroup>
      </Section>

      <Section>
        <SectionTitle>Meeting Participants</SectionTitle>
        
        <SettingGroup>
          <SettingLabel>Your Name (Own)</SettingLabel>
          <Input
            value={settings.userName}
            onChange={(value) => dispatch(updateSettings({ userName: value }))}
            placeholder="e.g., John Doe"
          />
          <SettingDescription>
            Display name for microphone transcription in Meetings
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Participant Name</SettingLabel>
          <Input
            value={settings.participantName}
            onChange={(value) => dispatch(updateSettings({ participantName: value }))}
            placeholder="e.g., Jane Smith"
          />
          <SettingDescription>
            Display name for system audio transcription in Meetings
          </SettingDescription>
        </SettingGroup>
      </Section>

      <Section>
        <SectionTitle>Limits & Behavior</SectionTitle>
        
        <SettingGroup>
          <SettingLabel>Max Screenshots</SettingLabel>
          <Input
            value={settings.maxScreenshots.toString()}
            onChange={(value) => handleMaxScreenshotsChange(parseInt(value) || 5)}
            type="number"
            min="1"
            max="10"
          />
          <SettingDescription>
            Maximum number of screenshots per query
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Auto Save Responses</SettingLabel>
          <Select
            value={settings.autoSave ? 'true' : 'false'}
            onChange={(e) => handleAutoSaveChange(e.target.value === 'true')}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </Select>
          <SettingDescription>
            Automatically save AI responses to files
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Default Save Location</SettingLabel>
          <Select
            value={settings.saveLocation}
            onChange={(e) => handleSaveLocationChange(e.target.value)}
          >
            <option value="downloads">Downloads</option>
            <option value="documents">Documents</option>
            <option value="desktop">Desktop</option>
          </Select>
          <SettingDescription>
            Default folder for saving responses
          </SettingDescription>
        </SettingGroup>
      </Section>

      <Section>
        <SectionTitle>Keyboard Shortcuts</SectionTitle>
        
        <SettingGroup>
          <SettingLabel>Screenshot Shortcut</SettingLabel>
          <Input
            value={settings.shortcuts.screenshot}
            onChange={(value) => dispatch(updateShortcut({ key: 'screenshot', value }))}
            placeholder="CmdOrCtrl+H"
          />
          <SettingDescription>
            Keyboard shortcut to capture screenshots
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Move Window Up</SettingLabel>
          <Input
            value={settings.shortcuts.moveUp || ''}
            onChange={(value) => dispatch(updateShortcut({ key: 'moveUp' as any, value }))}
            placeholder="CmdOrCtrl+Up"
          />
          <SettingDescription>
            Move the window up by 50px
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Move Window Down</SettingLabel>
          <Input
            value={settings.shortcuts.moveDown || ''}
            onChange={(value) => dispatch(updateShortcut({ key: 'moveDown' as any, value }))}
            placeholder="CmdOrCtrl+Down"
          />
          <SettingDescription>
            Move the window down by 50px
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Move Window Left</SettingLabel>
          <Input
            value={settings.shortcuts.moveLeft || ''}
            onChange={(value) => dispatch(updateShortcut({ key: 'moveLeft' as any, value }))}
            placeholder="CmdOrCtrl+Left"
          />
          <SettingDescription>
            Move the window left by 50px
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Move Window Right</SettingLabel>
          <Input
            value={settings.shortcuts.moveRight || ''}
            onChange={(value) => dispatch(updateShortcut({ key: 'moveRight' as any, value }))}
            placeholder="CmdOrCtrl+Right"
          />
          <SettingDescription>
            Move the window right by 50px
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Increase Opacity</SettingLabel>
          <Input
            value={settings.shortcuts.opacityIncrease || ''}
            onChange={(value) => dispatch(updateShortcut({ key: 'opacityIncrease' as any, value }))}
            placeholder="CmdOrCtrl+Alt+."
          />
          <SettingDescription>
            Increase window opacity by 10% (max 100%)
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Decrease Opacity</SettingLabel>
          <Input
            value={settings.shortcuts.opacityDecrease || ''}
            onChange={(value) => dispatch(updateShortcut({ key: 'opacityDecrease' as any, value }))}
            placeholder="CmdOrCtrl+Alt+,"
          />
          <SettingDescription>
            Decrease window opacity by 10% (min 20%)
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Toggle Visibility Shortcut</SettingLabel>
          <Input
            value={settings.shortcuts.toggleVisibility}
            onChange={(value) => dispatch(updateShortcut({ key: 'toggleVisibility', value }))}
            placeholder="CmdOrCtrl+Shift+V"
          />
          <SettingDescription>
            Keyboard shortcut to toggle app visibility
          </SettingDescription>
        </SettingGroup>

        <SettingGroup>
          <SettingLabel>Reset Shortcut</SettingLabel>
          <Input
            value={settings.shortcuts.reset}
            onChange={(value) => dispatch(updateShortcut({ key: 'reset', value }))}
            placeholder="CmdOrCtrl+R"
          />
          <SettingDescription>
            Keyboard shortcut to reset current session
          </SettingDescription>
        </SettingGroup>
      </Section>

      <ButtonGroup>
        <Button variant="outlined" onClick={handleResetSettings}>
          Reset to Defaults
        </Button>
      </ButtonGroup>
    </SettingsContainer>
  );
};
