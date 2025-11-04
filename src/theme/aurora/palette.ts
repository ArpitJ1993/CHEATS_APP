const neutral = {50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1F2937',900:'#0B1220'};
const primary = {50:'#F2F0FF',100:'#E5DEFF',200:'#CABDFF',300:'#B4A1FF',400:'#9E7CFF',500:'#7C4DFF',600:'#6A3CF0',700:'#5A2FDB',800:'#4B25C6',900:'#3A1FA5'};
const secondary = {50:'#ECFEFF',100:'#CFFAFE',200:'#A5F3FC',300:'#67E8F9',400:'#22D3EE',500:'#06B6D4',600:'#0891B2',700:'#0E7490',800:'#155E75',900:'#164E63'};
const accent = {50:'#FFF1F5',100:'#FFE4E9',200:'#FECDD3',300:'#FDA4AF',400:'#FB7185',500:'#F43F5E',600:'#E11D48',700:'#BE123C',800:'#9F1239',900:'#881337'};

export const buildLightPalette = () => ({
  mode: 'light' as const,
  primary: { main: primary[600], light: primary[400], dark: primary[800], contrastText: '#FFFFFF' },
  secondary: { main: secondary[500], light: secondary[300], dark: secondary[700], contrastText: '#042029' },
  error:   { main: '#EF4444' },
  warning: { main: '#F59E0B' },
  info:    { main: '#3B82F6' },
  success: { main: '#10B981' },
  text: { primary: neutral[900], secondary: neutral[600], disabled: 'rgba(15, 23, 42, 0.38)' },
  divider: 'rgba(15, 23, 42, 0.12)',
  background: { default: neutral[50], paper: '#FFFFFF' },
  grey: neutral,
  aurora: { primary, secondary, accent }
});

export const buildDarkPalette = () => ({
  mode: 'dark' as const,
  primary: { main: primary[400], light: primary[300], dark: primary[700], contrastText: '#0B1220' },
  secondary:{ main: secondary[400], light: secondary[300], dark: secondary[700], contrastText: '#081317' },
  error:   { main: '#F87171' },
  warning: { main: '#FBBF24' },
  info:    { main: '#60A5FA' },
  success: { main: '#34D399' },
  text: { primary: neutral[100], secondary: neutral[400], disabled: 'rgba(248,250,252,0.38)' },
  divider: 'rgba(248,250,252,0.16)',
  background: { default: '#0E1016', paper: '#11131A' },
  grey: neutral,
  aurora: { primary, secondary, accent }
});


