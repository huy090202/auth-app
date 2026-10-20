import { createTheme, type MantineColorsTuple } from '@mantine/core';

/*
 * Design direction (impeccable, one pass). Mode: Read for /docs, Operate for /app.
 *
 * "Engineering notebook": the page reads like a well-kept lab notebook a backend
 * engineer would hand a colleague. Warm paper, ink-black text, one accent. No hero,
 * no gradients, no emoji, no shadows beyond a 1px rule. Structure comes from rules
 * and spacing, not cards.
 *
 * Palette tokens
 *   paper   light #f7f5f0  dark #16161a   page background
 *   ink     light #1c1b19  dark #e8e6e1   body text
 *   muted   light #6b675f  dark #9a968e   secondary text, trace timings
 *   rule    light #dedad1  dark #2c2c31   1px dividers and borders
 *   accent  `signal` (vermilion, #c2410c at shade 7): links, primary buttons, the trace
 *           count badge. Nothing else is colored. Status in the trace uses Mantine
 *           green/red at low saturation only for the status code itself.
 *
 * Type scale (rem, ratio ~1.2, body 1rem/1.6)
 *   h1 1.75 / h2 1.4 / h3 1.15 / body 1 / small 0.875 / trace 0.8125
 *   Sans: the system UI stack (no web font to load). Mono: ui-monospace stack, used
 *   for all code, inline identifiers and the whole trace panel.
 *
 * Spacing: 4px base; xs 4, sm 8, md 16, lg 24, xl 40. Reading column max 72ch.
 * Radius: 4px small and quiet; buttons are not pills.
 */

const signal: MantineColorsTuple = [
  '#fff4ed', '#ffe6d5', '#fdc9aa', '#fba574', '#f97a3c', '#ea5a14', '#d24a0e', '#c2410c', '#9a3412', '#7c2d12',
];

export const tokens = {
  light: { paper: '#f7f5f0', ink: '#1c1b19', muted: '#6b675f', rule: '#dedad1' },
  dark: { paper: '#16161a', ink: '#e8e6e1', muted: '#9a968e', rule: '#2c2c31' },
};

export const monoFont = 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace';

export const theme = createTheme({
  primaryColor: 'signal',
  primaryShade: { light: 7, dark: 5 },
  colors: { signal },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: monoFont,
  defaultRadius: 'sm',
  radius: { xs: '2px', sm: '4px', md: '6px', lg: '8px', xl: '12px' },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.25' },
      h2: { fontSize: '1.4rem', lineHeight: '1.3' },
      h3: { fontSize: '1.15rem', lineHeight: '1.35' },
    },
  },
  fontSizes: { xs: '0.8125rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem' },
  lineHeights: { md: '1.6' },
});

// Paper/ink/rule as CSS variables so both schemes are set in one place.
export const cssVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': tokens.light.paper,
    '--mantine-color-text': tokens.light.ink,
    '--mantine-color-dimmed': tokens.light.muted,
    '--mantine-color-default-border': tokens.light.rule,
  },
  dark: {
    '--mantine-color-body': tokens.dark.paper,
    '--mantine-color-text': tokens.dark.ink,
    '--mantine-color-dimmed': tokens.dark.muted,
    '--mantine-color-default-border': tokens.dark.rule,
  },
});
