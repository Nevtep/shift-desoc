'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { XStack, Select, Adapt, Sheet } from 'tamagui'
import { setLanguageAction } from '../actions/set-language'
import { useLanguage, useTranslations } from '../lib/i18n/I18nContext'
import type { Language } from '../lib/i18n'

interface LanguageSelectorProps {
  onLanguageChange?: (language: Language) => Promise<void> | void
}

export default function LanguageSelector({ onLanguageChange }: LanguageSelectorProps) {
  const [currentLanguage, setLanguage] = useLanguage()
  const t = useTranslations()
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
    <XStack
      top="$4"
      right="$4"
      zIndex={1000}
      style={{ position: 'fixed' }}
    >
      <Select
        value={currentLanguage}
        onValueChange={handleValueChange}
        size="$3"
      >
        <Select.Trigger
          width={140}
          borderWidth={2}
          borderColor="$textDark"
          backgroundColor="$white"
          borderRadius="$2"
          paddingHorizontal="$3"
          paddingVertical="$2"
          cursor="pointer"
          disabled={isPending}
          opacity={isPending ? 0.6 : 1}
          hoverStyle={{
            backgroundColor: '$background',
            scale: 1.05,
          }}
          focusStyle={{
            borderColor: '$primary',
          }}
        >
          <Select.Value placeholder={t.langSelector} />
        </Select.Trigger>
        <Adapt when="sm" platform="touch">
          <Sheet modal dismissOnSnapToBottom>
            <Sheet.Frame>
              <Sheet.ScrollView>
                <Adapt.Contents />
              </Sheet.ScrollView>
            </Sheet.Frame>
            <Sheet.Overlay />
          </Sheet>
        </Adapt>
        <Select.Content zIndex={200000}>
          <Select.ScrollUpButton />
          <Select.Viewport>
            <Select.Item index={0} value="es">
              <Select.ItemText>Español</Select.ItemText>
            </Select.Item>
            <Select.Item index={1} value="en">
              <Select.ItemText>English</Select.ItemText>
            </Select.Item>
          </Select.Viewport>
          <Select.ScrollDownButton />
        </Select.Content>
      </Select>
    </XStack>
  )
}
