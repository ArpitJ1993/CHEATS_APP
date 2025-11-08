import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppSettings } from '../types';
import type { VendorId } from '../vendors/types';

interface SettingsSliceState {
  settings: AppSettings;
  isLoaded: boolean;
}

const createDefaultVendorKeys = (): Record<VendorId, string> => ({
  openai: '',
  gemini: '',
  anthropic: '',
  perplexity: ''
});

const defaultSettings: AppSettings = {
  theme: 'auto',
  fontSize: 'medium',
  apiKey: '',
  vendor: 'openai',
  vendorKeys: createDefaultVendorKeys(),
  userName: '',
  participantName: '',
  maxScreenshots: 5,
  autoSave: true,
  saveLocation: 'downloads',
  shortcuts: {
    screenshot: 'CmdOrCtrl+H',
    toggleVisibility: 'CmdOrCtrl+Shift+V',
    reset: 'CmdOrCtrl+R',
    moveUp: 'CmdOrCtrl+Up',
    moveDown: 'CmdOrCtrl+Down',
    moveLeft: 'CmdOrCtrl+Left',
    moveRight: 'CmdOrCtrl+Right',
    opacityIncrease: 'CmdOrCtrl+Alt+.',
    opacityDecrease: 'CmdOrCtrl+Alt+,',
  },
};

const initialState: SettingsSliceState = {
  settings: defaultSettings,
  isLoaded: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    loadSettings: (state, action: PayloadAction<AppSettings>) => {
      state.settings = {
        ...defaultSettings,
        ...action.payload,
        vendorKeys: {
          ...createDefaultVendorKeys(),
          ...(action.payload.vendorKeys || {})
        }
      };
      state.settings.apiKey = state.settings.vendorKeys[state.settings.vendor] || '';
      state.isLoaded = true;
    },
    updateSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      const vendorKeys = action.payload.vendorKeys
        ? { ...state.settings.vendorKeys, ...action.payload.vendorKeys }
        : state.settings.vendorKeys;
      state.settings = { ...state.settings, ...action.payload, vendorKeys };
      state.settings.apiKey = state.settings.vendorKeys[state.settings.vendor] || '';
    },
    setVendor: (state, action: PayloadAction<VendorId>) => {
      state.settings.vendor = action.payload;
      state.settings.apiKey = state.settings.vendorKeys[action.payload] || '';
    },
    setVendorApiKey: (state, action: PayloadAction<{ vendor: VendorId; key: string }>) => {
      state.settings.vendorKeys = {
        ...state.settings.vendorKeys,
        [action.payload.vendor]: action.payload.key
      };
      if (state.settings.vendor === action.payload.vendor) {
        state.settings.apiKey = action.payload.key;
      }
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.settings.theme = action.payload;
    },
    setFontSize: (state, action: PayloadAction<'small' | 'medium' | 'large'>) => {
      state.settings.fontSize = action.payload;
    },
    setApiKey: (state, action: PayloadAction<string>) => {
      state.settings.vendorKeys = {
        ...state.settings.vendorKeys,
        openai: action.payload
      };
      if (state.settings.vendor === 'openai') {
        state.settings.apiKey = action.payload;
      }
    },
    setMaxScreenshots: (state, action: PayloadAction<number>) => {
      state.settings.maxScreenshots = action.payload;
    },
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.settings.autoSave = action.payload;
    },
    setSaveLocation: (state, action: PayloadAction<string>) => {
      state.settings.saveLocation = action.payload;
    },
    updateShortcut: (state, action: PayloadAction<{ key: keyof AppSettings['shortcuts']; value: string }>) => {
      state.settings.shortcuts[action.payload.key] = action.payload.value;
    },
    resetSettings: (state) => {
      state.settings = {
        ...defaultSettings,
        vendorKeys: createDefaultVendorKeys()
      };
    },
  },
});

export const {
  loadSettings,
  updateSettings,
  setVendor,
  setVendorApiKey,
  setTheme,
  setFontSize,
  setApiKey,
  setMaxScreenshots,
  setAutoSave,
  setSaveLocation,
  updateShortcut,
  resetSettings,
} = settingsSlice.actions;

export { settingsSlice };
