/**
 * Design tokens for the Timetable Mobile design system.
 *
 * These mirror the Tailwind theme in tailwind.config.js so components can use
 * either NativeWind utility classes or raw token values.
 */

export const colors = {
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  primaryHover: "#4338CA",
  primaryMuted: "#818CF8",
  accent: "#0D9488",
  accentSoft: "#CCFBF1",
  surface: "#FFFFFF",
  canvas: "#F8FAFC",
  ink: "#0F172A",
  inkSecondary: "#475569",
  inkMuted: "#94A3B8",
  line: "#E2E8F0",
  danger: "#E11D48",
  dangerSoft: "#FFF1F2",
  success: "#059669",
  successSoft: "#ECFDF5",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  white: "#FFFFFF",
  transparent: "transparent",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, lineHeight: 36, fontWeight: "800" as const },
  h2: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: "700" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  captionMedium: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "700" as const },
} as const;
