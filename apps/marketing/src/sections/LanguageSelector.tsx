'use client'

import React, { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe2 } from 'lucide-react'
import { Paragraph, XStack, YStack, styled } from 'tamagui'
import { setLanguageAction } from '../actions/set-language'
import { useLanguage } from '../providers/i18n/I18nContext'
import type { Language } from '../providers/i18n'

interface LanguageSelectorProps {
  onLanguageChange?: (language: Language) => Promise<void> | void
  variant?: 'dropdown' | 'inline'
}

export default function LanguageSelector({ onLanguageChange, variant = 'dropdown' }: LanguageSelectorProps) {
  const [currentLanguage, setLanguage] = useLanguage()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

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

  const toggleMenu = () => {
    if (isPending) return
    setIsOpen((prev) => !prev)
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const languages: { value: Language; label: string }[] = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
  ]

  if (variant === 'inline') {
    return (
      <InlineWrapper>
        <XStack alignItems="center" gap="$2">
          <Globe2 size={20} color="#6C8158" strokeWidth={2.2} />
          <Paragraph fontSize={14} fontWeight="700" color="#6C8158">
            Idioma
          </Paragraph>
        </XStack>
        <XStack gap="$2" alignItems="center">
          {languages.map((lang) => {
            const active = currentLanguage === lang.value
            return (
              <InlineOption
                key={lang.value}
                role="button"
                aria-label={`Cambiar a ${lang.label}`}
                disabled={isPending}
                onPress={() => {
                  if (isPending) return
                  handleValueChange(lang.value)
                }}
                borderColor={active ? '#6C8158' : '#d4d6c9'}
                backgroundColor={active ? '#F0F4EC' : 'transparent'}
              >
                <Paragraph fontSize={14} fontWeight={active ? '800' : '700'} color="#6C8158">
                  {lang.value.toUpperCase()}
                </Paragraph>
              </InlineOption>
            )
          })}
        </XStack>
      </InlineWrapper>
    )
  }

  return (
    <MenuWrapper ref={menuRef}>
      <XStack
        role="button"
        aria-label="Cambiar idioma"
        aria-haspopup="true"
        aria-expanded={isOpen}
        alignItems="center"
        gap="$2"
        cursor={isPending ? 'default' : 'pointer'}
        opacity={isPending ? 0.65 : 0.9}
        onPress={toggleMenu}
        hoverStyle={{
          opacity: 1,
          scale: 1.05,
        }}
        pressStyle={{
          scale: 0.97,
        }}
      >
        <Globe2 size={22} color="#6C8158" strokeWidth={2.4} />
        <Paragraph fontSize={14} fontWeight="700" color="#6C8158">
          {currentLanguage.toUpperCase()}
        </Paragraph>
      </XStack>

      {isOpen ? (
        <Dropdown
          role="menu"
          aria-label="Seleccionar idioma"
          elevation="$2"
          shadowColor="#0000001a"
        >
          {languages.map((lang) => (
            <DropdownItem
              key={lang.value}
              role="menuitem"
              onPress={() => {
                setIsOpen(false)
                handleValueChange(lang.value)
              }}
              backgroundColor={currentLanguage === lang.value ? '#F0F4EC' : 'white'}
            >
              <Paragraph
                fontSize={14}
                fontWeight={currentLanguage === lang.value ? '800' : '600'}
                color="#6C8158"
              >
                {lang.label}
              </Paragraph>
            </DropdownItem>
          ))}
        </Dropdown>
      ) : null}
    </MenuWrapper>
  )
}

const MenuWrapper = styled(YStack, {
  position: 'relative',
})

const InlineWrapper = styled(YStack, {
  gap: '$2',
})

const InlineOption = styled(XStack, {
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: '$2',
  paddingHorizontal: '$3',
  borderRadius: '$3',
  borderWidth: 1,
  minWidth: 64,
  cursor: 'pointer',
  pressStyle: { scale: 0.97 },
})

const Dropdown = styled(YStack, {
  position: 'absolute',
  top: '105%',
  right: 0,
  backgroundColor: 'white',
  borderRadius: '$3',
  paddingVertical: '$2',
  paddingHorizontal: '$3',
  gap: '$2',
  minWidth: 130,
  borderWidth: 1,
  borderColor: '#e5e7eb',
  zIndex: 20,
})

const DropdownItem = styled(XStack, {
  alignItems: 'center',
  paddingVertical: '$1.5',
  paddingHorizontal: '$2',
  borderRadius: '$2',
  cursor: 'pointer',
  hoverStyle: {
    backgroundColor: '#F8FAF5',
  },
  pressStyle: {
    scale: 0.99,
  },
})
