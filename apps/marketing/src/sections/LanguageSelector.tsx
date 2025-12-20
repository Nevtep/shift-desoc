'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Paragraph, XStack } from 'tamagui'
import { setLanguageAction } from '../actions/set-language'
import { useLanguage } from '../providers/i18n/I18nContext'
import type { Language } from '../providers/i18n'

interface LanguageSelectorProps {
  onLanguageChange?: (language: Language) => Promise<void> | void
}

export default function LanguageSelector({ onLanguageChange }: LanguageSelectorProps) {
  const [currentLanguage, setLanguage] = useLanguage()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleValueChange = (value: string) => {
    const nextLanguage = (value === 'en' ? 'en' : 'es') as Language
    setLanguage(nextLanguage)

    startTransition(async () => {
      try {
        if (onLanguageChange) {
          await onLanguageChange(nextLanguage)
        } else {
          await setLanguageAction(nextLanguage)
        }
      } finally {
        // Refresh to pickup new locale on server-rendered content when available
        if (typeof router.refresh === 'function') {
          router.refresh()
        }
      }
    })
  }

  const cycleLanguage = () => {
    const nextLanguage = currentLanguage === 'es' ? 'en' : 'es'
    handleValueChange(nextLanguage)
  }

  return (
    <XStack
      role="button"
      aria-label="Cambiar idioma"
      alignItems="center"
      gap="$2"
      cursor={isPending ? 'default' : 'pointer'}
      opacity={isPending ? 0.65 : 0.9}
      onPress={isPending ? undefined : cycleLanguage}
      hoverStyle={{
        opacity: 1,
        scale: 1.03,
      }}
      pressStyle={{
        scale: 0.98,
      }}
    >
      <Paragraph fontSize={20}>🌐</Paragraph>
      <Paragraph fontSize={14} fontWeight="700" color="#6C8158">
        Idioma
      </Paragraph>
    </XStack>
  )
}
