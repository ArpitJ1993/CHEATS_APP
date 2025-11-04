import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';
import { buildLightPalette, buildDarkPalette } from './palette';
import { typography } from './typography';

const base = (mode: 'light' | 'dark') => {
  const palette = mode === 'light' ? buildLightPalette() : buildDarkPalette();
  return createTheme({
    palette: palette as any,
    shape: { borderRadius: tokens.radius.md },
    spacing: tokens.spacing,
    typography: { fontFamily: typography.fontFamily },
    components: {
      MuiCssBaseline: {
        styleOverrides: (th: any) => ({
          body: { background: th.palette.background.default, color: th.palette.text.primary },
        })
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: tokens.radius.lg, fontWeight: 600 },
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }: any) => ({ border: `1px solid ${theme.palette.divider}` })
        }
      }
    }
  });
};

export const lightTheme = base('light');
export const darkTheme = base('dark');


