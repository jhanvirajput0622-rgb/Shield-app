/**
 * Shield design system — dark "control room" aesthetic.
 * Dark-only for v1 (documented as a known limitation, not an oversight).
 */

const shield = {
  // Background layers
  background: "#0A0E13",
  surface: "#12181F",
  elevated: "#1A222B",

  // Borders
  border: "#242D38",
  borderStrong: "#37424F",

  // Text
  text: "#F3F6F9",
  foreground: "#F3F6F9",
  mutedForeground: "#93A1B0",
  textDisabled: "#5B6570",

  // Accent / primary
  primary: "#2FE6C3",
  primaryDim: "#1C8F7C",
  primaryForeground: "#0A0E13",
  tint: "#2FE6C3",

  // Risk scale
  safe: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  critical: "#EF4444",

  // Semantic aliases (required by useColors hook)
  card: "#12181F",
  cardForeground: "#F3F6F9",
  secondary: "#1A222B",
  secondaryForeground: "#93A1B0",
  muted: "#242D38",
  mutedForegroundAlt: "#5B6570",
  accent: "#2FE6C3",
  accentForeground: "#0A0E13",
  destructive: "#EF4444",
  destructiveForeground: "#ffffff",
  input: "#242D38",
};

const colors = {
  light: shield,
  dark: shield,
  radius: 12,
};

export default colors;
