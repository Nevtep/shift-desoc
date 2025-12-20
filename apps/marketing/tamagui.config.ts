import { createTamagui } from '@tamagui/core'
import { config as defaultConfig } from '@tamagui/config/v3'

// Colores basados en la imagen
const shiftColors = {
  bgBeige: '#F6F0E1',
  bgLight: '#FAFAF5',
  textDark: '#2C2C2C',
  textMedium: '#4A4A4A',
  green: '#6C8158',
  greenDark: '#566645',
  orange: '#DD8848',
  orangeDark: '#c4733c',
  blue: '#B23B3B',
  greyLight: '#E0E0D0',
  greyMedium: '#8B8B7A',
  white: '#FFFFFF',
}

const appConfig = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    color: {
      ...defaultConfig.tokens.color,
      background: shiftColors.bgBeige,
      backgroundLight: shiftColors.bgLight,
      text: shiftColors.textDark,
      textDark: shiftColors.textDark,
      textMedium: shiftColors.textMedium,
      primary: shiftColors.green,
      primaryDark: shiftColors.greenDark,
      secondary: shiftColors.orange,
      secondaryDark: shiftColors.orangeDark,
      accent: shiftColors.blue,
      greyLight: shiftColors.greyLight,
      greyMedium: shiftColors.greyMedium,
      white: shiftColors.white,
    },
    space: {
      ...defaultConfig.tokens.space,
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      7: 28,
      8: 32,
      9: 36,
      10: 40,
      12: 48,
      14: 56,
      16: 64,
      20: 80,
    },
    size: {
      ...defaultConfig.tokens.size,
      container: 1200,
    },
    radius: {
      ...defaultConfig.tokens.radius,
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
    },
  },
  themes: {
    light: {
      ...defaultConfig.themes.light,
      background: shiftColors.bgBeige,
      backgroundLight: shiftColors.bgLight,
      color: shiftColors.textDark,
      colorHover: shiftColors.textMedium,
      textDark: shiftColors.textDark,
      textMedium: shiftColors.textMedium,
    },
  },
  fonts: {
    ...defaultConfig.fonts,
    heading: {
      ...defaultConfig.fonts.heading,
      family:
        'var(--font-epilogue), "Epilogue", var(--font-inter), "Inter", "Helvetica Neue", Arial, sans-serif',
    },
    body: {
      ...defaultConfig.fonts.body,
      family:
        'var(--font-inter), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
  },
})

export default appConfig

export type Conf = typeof appConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}
