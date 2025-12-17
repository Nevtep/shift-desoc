'use client'

import { TamaguiProvider as BaseTamaguiProvider } from '@tamagui/core'
import config from '../../../tamagui.config'

export function TamaguiProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseTamaguiProvider config={config} defaultTheme="light">
      {children}
    </BaseTamaguiProvider>
  )
}
