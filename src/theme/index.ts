import { Theme, ThemeColors } from '../types';
import { ThemeMode } from '../enums';
import { createTheme as createMuiTheme, ThemeOptions } from '@mui/material/styles';
import { tokens } from './aurora/tokens';
import { buildLightPalette, buildDarkPalette } from './aurora/palette';
import { typography as auroraTypography } from './aurora/typography';

declare module '@mui/material/styles' {
  interface Palette {
    aurora: { primary: any; secondary: any; accent: any };
  }
  interface PaletteOptions {
    aurora?: { primary: any; secondary: any; accent: any };
  }
}

// Aurora palettes from prompt
const neutral = {50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1F2937',900:'#0B1220'};
const primary = {50:'#F2F0FF',100:'#E5DEFF',200:'#CABDFF',300:'#B4A1FF',400:'#9E7CFF',500:'#7C4DFF',600:'#6A3CF0',700:'#5A2FDB',800:'#4B25C6',900:'#3A1FA5'};
const secondary = {50:'#ECFEFF',100:'#CFFAFE',200:'#A5F3FC',300:'#67E8F9',400:'#22D3EE',500:'#06B6D4',600:'#0891B2',700:'#0E7490',800:'#155E75',900:'#164E63'};

// Map Aurora palette to existing ThemeColors shape used for CSS variables
const buildLightColors = (): ThemeColors => ({
  primary: primary[600],
  secondary: secondary[500],
  background: neutral[50],
  surface: '#FFFFFF',
  text: neutral[900],
  textSecondary: neutral[600],
  border: 'rgba(15,23,42,0.12)',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6'
});

const buildDarkColors = (): ThemeColors => ({
  primary: primary[400],
  secondary: secondary[400],
  background: '#0E1016',
  surface: '#11131A',
  text: neutral[100],
  textSecondary: neutral[400],
  border: 'rgba(248,250,252,0.16)',
  error: '#F87171',
  warning: '#FBBF24',
  success: '#34D399',
  info: '#60A5FA'
});

const getSystemThemePreference = (): ThemeMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? ThemeMode.DARK 
      : ThemeMode.LIGHT;
  }
  return ThemeMode.LIGHT;
};

export const createTheme = (mode: ThemeMode, _highContrast = false): Theme => {
  const effectiveMode = mode === ThemeMode.AUTO ? getSystemThemePreference() : mode;
  const colors = effectiveMode === ThemeMode.DARK ? buildDarkColors() : buildLightColors();

  return {
    mode: effectiveMode as 'light' | 'dark' | 'auto',
    colors,
    typography: {
      fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol", sans-serif',
      fontSize: {
        small: '12px',
        medium: '14px',
        large: '16px'
      }
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px'
    }
  };
};

export const getThemeColors = (mode: ThemeMode): ThemeColors => {
  return mode === ThemeMode.DARK ? buildDarkColors() : buildLightColors();
};

export const getContrastColor = (backgroundColor: string): string => {
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
};

export const generateCSSVariables = (theme: Theme): Record<string, string> => ({
  '--color-primary': theme.colors.primary,
  '--color-secondary': theme.colors.secondary,
  '--color-background': theme.colors.background,
  '--color-surface': theme.colors.surface,
  '--color-text': theme.colors.text,
  '--color-text-secondary': theme.colors.textSecondary,
  '--color-border': theme.colors.border,
  '--color-error': theme.colors.error,
  '--color-warning': theme.colors.warning,
  '--color-success': theme.colors.success,
  '--color-info': theme.colors.info,
  '--font-family': theme.typography.fontFamily,
  '--font-size-small': theme.typography.fontSize.small,
  '--font-size-medium': theme.typography.fontSize.medium,
  '--font-size-large': theme.typography.fontSize.large,
  '--spacing-xs': theme.spacing.xs,
  '--spacing-sm': theme.spacing.sm,
  '--spacing-md': theme.spacing.md,
  '--spacing-lg': theme.spacing.lg,
  '--spacing-xl': theme.spacing.xl
});

export const defaultLightTheme = createTheme(ThemeMode.LIGHT);
export const defaultDarkTheme = createTheme(ThemeMode.DARK);
export const defaultHighContrastTheme = createTheme(ThemeMode.LIGHT);

// Aurora MUI theme (Light/Dark) per prompt-mui-theme-wow.md
const base = (mode: 'light' | 'dark'): ThemeOptions => {
  const palette = mode === 'light' ? buildLightPalette() : buildDarkPalette();
  return {
    palette: palette as any,
    shape: { borderRadius: tokens.radius.md },
    spacing: tokens.spacing,
    typography: {
      ...auroraTypography,
      fontFamily: auroraTypography.fontFamily,
    } as any,
    components: {
      MuiCssBaseline: {
        styleOverrides: (th: any) => ({
          ':root': {
            '--radius-xs': `${tokens.radius.xs}px`,
            '--radius-sm': `${tokens.radius.sm}px`,
            '--radius-md': `${tokens.radius.md}px`,
            '--radius-lg': `${tokens.radius.lg}px`,
            '--shadow-focus': '0 0 0 3px rgba(124,77,255,0.35)'
          },
          body: { background: th.palette.background.default, color: th.palette.text.primary },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { animation: 'none !important', transition: 'none !important' }
          }
        })
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ theme }: any) => ({
            borderRadius: tokens.radius.lg,
            fontWeight: 600,
            letterSpacing: 0.2,
            paddingInline: theme.spacing(2.25),
            paddingBlock: theme.spacing(1.25),
            transition: `all ${tokens.motion.duration.md}ms ${tokens.motion.easing.standard}`,
            '&:focus-visible': { boxShadow: 'var(--shadow-focus)' }
          }),
          containedPrimary: ({ theme }: any) => ({
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.aurora.secondary[500]})`,
            color: theme.palette.primary.contrastText
          })
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }: any) => ({ border: `1px solid ${theme.palette.divider}` })
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }: any) => ({
            borderRadius: tokens.radius.md,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main, boxShadow: 'var(--shadow-focus)' }
          })
        }
      },
      MuiTabs: {
        styleOverrides: {
          indicator: ({ theme }: any) => ({
            height: 3,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
          })
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }: any) => ({ borderRadius: tokens.radius.md, border: `1px solid ${theme.palette.divider}` })
        }
      },
      MuiTooltip: {
        styleOverrides: { tooltip: ({ theme }: any) => ({ borderRadius: tokens.radius.sm, padding: theme.spacing(1) }) }
      },
      MuiSnackbarContent: {
        styleOverrides: { root: () => ({ borderRadius: tokens.radius.lg, backdropFilter: 'blur(10px)' }) }
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: ({ theme }: any) => ({ '&.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main } }),
          track: ({ theme }: any) => ({ backgroundColor: theme.palette.mode === 'light' ? theme.palette.grey[300] : theme.palette.grey[700], opacity: 1 }),
          thumb: { boxShadow: 'none' }
        }
      }
    }
  };
};

export const lightTheme = createMuiTheme(base('light'));
export const darkTheme = createMuiTheme(base('dark'));
