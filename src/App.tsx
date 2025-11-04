import React, { useEffect } from 'react';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import { store, RootState } from './store';
import { AppContainer } from './components/AppContainer';
import { createTheme } from './theme';
import { lightTheme as auroraLight, darkTheme as auroraDark } from './theme';
import { ThemeMode } from './enums';
import { updateTheme } from './slices/themeSlice';

const AppContent: React.FC = () => {
  const dispatch = useDispatch();
  const themeMode = useSelector((state: RootState) => state.theme.mode);
  const highContrast = useSelector((state: RootState) => state.theme.highContrast);
  const currentTheme = useSelector((state: RootState) => state.theme.currentTheme);

  useEffect(() => {
    // Apply CSS variables to document root
    const root = document.documentElement;
    const cssVariables = {
      '--color-primary': currentTheme.colors.primary,
      '--color-secondary': currentTheme.colors.secondary,
      '--color-background': currentTheme.colors.background,
      '--color-surface': currentTheme.colors.surface,
      '--color-text': currentTheme.colors.text,
      '--color-text-secondary': currentTheme.colors.textSecondary,
      '--color-border': currentTheme.colors.border,
      '--color-error': currentTheme.colors.error,
      '--color-warning': currentTheme.colors.warning,
      '--color-success': currentTheme.colors.success,
      '--color-info': currentTheme.colors.info,
      '--font-family': currentTheme.typography.fontFamily,
      '--font-size-small': currentTheme.typography.fontSize.small,
      '--font-size-medium': currentTheme.typography.fontSize.medium,
      '--font-size-large': currentTheme.typography.fontSize.large,
      '--spacing-xs': currentTheme.spacing.xs,
      '--spacing-sm': currentTheme.spacing.sm,
      '--spacing-md': currentTheme.spacing.md,
      '--spacing-lg': currentTheme.spacing.lg,
      '--spacing-xl': currentTheme.spacing.xl,
    };

    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [currentTheme]);

  // Listen for system theme changes when in AUTO mode
  useEffect(() => {
    if (themeMode === ThemeMode.AUTO && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleSystemThemeChange = () => {
        const newTheme = createTheme(ThemeMode.AUTO, highContrast);
        dispatch(updateTheme(newTheme));
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, [themeMode, highContrast, dispatch]);

  // Prefer Aurora theme variants while preserving existing CSS vars logic
  const muiTheme = currentTheme.mode === ThemeMode.DARK ? auroraDark : auroraLight;

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AppContainer />
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
