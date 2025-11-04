export const tokens = {
  radius: { xs: 8, sm: 10, md: 12, lg: 14, xl: 18, pill: 999 },
  spacing: 4,
  shadowsLight: [
    'none',
    '0 1px 2px rgba(2,6,23,0.06), 0 1px 1px rgba(2,6,23,0.04)',
    '0 2px 6px rgba(2,6,23,0.07), 0 1px 2px rgba(2,6,23,0.05)',
    '0 6px 16px rgba(2,6,23,0.08), 0 2px 6px rgba(2,6,23,0.06)',
    '0 10px 24px rgba(2,6,23,0.10), 0 4px 10px rgba(2,6,23,0.08)'
  ],
  shadowsDark: [
    'none',
    '0 1px 2px rgba(0,0,0,0.45)',
    '0 2px 6px rgba(0,0,0,0.5)',
    '0 6px 16px rgba(0,0,0,0.55)',
    '0 10px 24px rgba(0,0,0,0.6)'
  ],
  motion: {
    duration: { xs: 120, sm: 180, md: 220, lg: 320 },
    easing: {
      standard: 'cubic-bezier(.2,.8,.2,1)',
      emphasized: 'cubic-bezier(.2,.0,0,1)'
    }
  }
} as const;


