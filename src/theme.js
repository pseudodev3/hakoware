/**
 * Hakoware design tokens.
 * Mirrors the CSS variables used by the interface.
 */
export const theme = {
  colors: {
    bg: {
      primary: '#090907',
      secondary: '#0d0d0b',
      tertiary: '#12120f',
      elevated: '#171711'
    },
    border: {
      default: 'rgba(247, 244, 236, 0.075)',
      hover: 'rgba(247, 244, 236, 0.14)',
      active: 'rgba(247, 244, 236, 0.2)'
    },
    text: {
      primary: '#f7f4ec',
      secondary: '#b8b3a7',
      muted: '#777268',
      disabled: '#504d46'
    },
    accent: {
      gold: '#e7b35a',
      red: '#ff747b',
      green: '#62d6a2',
      orange: '#e99c5a',
      blue: '#7aa7ff',
      purple: '#a78bfa',
      magenta: '#e88ad4'
    }
  },
  spacing: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '24px', '3xl': '32px' },
  radius: { sm: '10px', md: '14px', lg: '20px', xl: '28px', full: '999px' },
  shadows: {
    sm: '0 8px 24px rgba(0,0,0,.18)',
    md: '0 18px 48px rgba(0,0,0,.22)',
    lg: '0 28px 80px rgba(0,0,0,.42)',
    glow: (color) => `0 0 32px ${color}26`,
    glowSm: (color) => `0 0 18px ${color}20`
  },
  transitions: {
    fast: 'transform 140ms cubic-bezier(0.2, 0, 0, 1), opacity 140ms cubic-bezier(0.2, 0, 0, 1)',
    default: 'transform 220ms cubic-bezier(0.2, 0, 0, 1), opacity 220ms cubic-bezier(0.2, 0, 0, 1)',
    slow: 'transform 280ms cubic-bezier(0.2, 0, 0, 1), opacity 280ms cubic-bezier(0.2, 0, 0, 1)'
  },
  typography: {
    size: { xs: '.7rem', sm: '.78rem', md: '.9rem', lg: '1rem', xl: '1.2rem', '2xl': '1.5rem' },
    weight: { normal: 400, medium: 500, semibold: 600, bold: 700 }
  }
};

export const mixins = {
  card: {
    background: theme.colors.bg.tertiary,
    boxShadow: `inset 0 0 0 1px ${theme.colors.border.default}, ${theme.shadows.md}`,
    borderRadius: theme.radius.lg
  },
  button: {
    base: {
      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      borderRadius: theme.radius.md,
      fontWeight: theme.typography.weight.semibold,
      cursor: 'pointer',
      border: 'none',
      fontFamily: 'inherit'
    },
    hover: { transform: 'translateY(-1px)' },
    active: { transform: 'scale(.96)' }
  },
  flexCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  flexBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
};

export default theme;
