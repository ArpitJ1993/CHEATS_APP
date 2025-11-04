import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ThemeMode } from '../enums';
import { Theme } from '../types';
import { createTheme } from '../theme';

interface ThemeState {
  mode: ThemeMode;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  currentTheme: Theme;
}

const initialState: ThemeState = {
  mode: ThemeMode.AUTO,
  highContrast: false,
  fontSize: 'medium',
  currentTheme: createTheme(ThemeMode.LIGHT),
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.mode = action.payload;
      state.currentTheme = createTheme(action.payload, state.highContrast);
    },
    setHighContrast: (state, action: PayloadAction<boolean>) => {
      state.highContrast = action.payload;
      state.currentTheme = createTheme(state.mode, action.payload);
    },
    setFontSize: (state, action: PayloadAction<'small' | 'medium' | 'large'>) => {
      state.fontSize = action.payload;
      // Update theme with new font size
      state.currentTheme = {
        ...state.currentTheme,
        typography: {
          ...state.currentTheme.typography,
          fontSize: {
            small: action.payload === 'small' ? '10px' : '12px',
            medium: action.payload === 'medium' ? '14px' : action.payload === 'large' ? '16px' : '14px',
            large: action.payload === 'large' ? '18px' : '16px',
          }
        }
      };
    },
    toggleTheme: (state) => {
      const newMode = state.mode === ThemeMode.LIGHT ? ThemeMode.DARK : ThemeMode.LIGHT;
      state.mode = newMode;
      state.currentTheme = createTheme(newMode, state.highContrast);
    },
    updateTheme: (state, action: PayloadAction<Theme>) => {
      state.currentTheme = action.payload;
    },
  },
});

export const { setThemeMode, setHighContrast, setFontSize, toggleTheme, updateTheme } = themeSlice.actions;
export { themeSlice };
