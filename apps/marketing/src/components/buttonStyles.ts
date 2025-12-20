import type { AnchorProps } from 'tamagui'

// Estilos comunes para botones secundarios
export const secondaryGradientButton: Partial<AnchorProps> = {
  backgroundColor: '$secondary',
  color: '$white',
  borderRadius: '$3',
  paddingVertical: '$3',
  paddingHorizontal: '$5',
  fontSize: '$5',
  fontWeight: '700',
  textDecorationLine: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 0,
  // Usamos el mismo degradado que el header
  style: {
    backgroundImage: 'linear-gradient(135deg, #E09B3F 0%, #DD8649 100%)',
  },
  hoverStyle: { backgroundColor: '$secondaryDark' },
}

export const secondaryOutlineButton: Partial<AnchorProps> = {
  backgroundColor: 'transparent',
  color: '$secondary',
  borderRadius: '$3',
  paddingVertical: '$3',
  paddingHorizontal: '$5',
  fontSize: '$5',
  fontWeight: '700',
  textDecorationLine: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  borderColor: '$secondary',
  hoverStyle: { borderColor: '$secondaryDark', color: '$secondaryDark' },
}
