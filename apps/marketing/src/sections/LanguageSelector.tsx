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

  return (
    <XStack gap="$3" alignItems="center">
      {[
        { code: 'es', label: 'Esp', flag: '🇪🇸' },
        { code: 'en', label: 'Eng', flag: '🇺🇸' },
      ].map((lang) => {
        const isActive = currentLanguage === lang.code

        return (
          <XStack
            key={lang.code}
            role="button"
            aria-label={lang.code === 'es' ? 'Cambiar a Español' : 'Switch to English'}
            onPress={() => handleValueChange(lang.code)}
            cursor="pointer"
            opacity={isActive ? 1 : 0.55}
            hoverStyle={{
              opacity: 0.9,
              scale: 1.05,
            }}
            pressStyle={{
              scale: 0.97,
            }}
            disabled={isPending}
          >
            <Paragraph fontSize={22}>{lang.flag}</Paragraph>
          </XStack>
        )
      })}
    </XStack>
  )
}
