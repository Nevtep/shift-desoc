import { createTamagui } from '@tamagui/core'
import { config as defaultConfig } from '@tamagui/config/v3'

// Colores basados en la imagen
const shiftColors = {
  bgBeige: '#F5F5E8',
  bgLight: '#FAFAF5',
  textDark: '#2C2C2C',
  textMedium: '#4A4A4A',
  green: '#4CAF50',
  greenDark: '#388E3C',
  orange: '#FF9800',
  orangeDark: '#F57C00',
  blue: '#2196F3',
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
    body: {
      family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      size: {
        1: 12,
        2: 14,
        3: 16,
        4: 18,
        5: 20,
        6: 24,
        7: 28,
        8: 32,
        9: 36,
        10: 40,
        11: 48,
        12: 56,
      },
    },
  },
})

export default appConfig

export type Conf = typeof appConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}
