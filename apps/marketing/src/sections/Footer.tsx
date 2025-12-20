'use client'

import React from 'react'
import { YStack, Paragraph, XStack, Anchor } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Footer() {
  const t = useTranslations()

  const navItems = [
    { label: t.navHome, href: '#home' },
    { label: t.navAbout, href: '#about' },
    { label: t.navPrinciples, href: '#principles' },
    { label: t.navSolutions, href: '#solutions' },
    { label: t.navApplications, href: '#applications' },
    { label: t.navWhitepaper, href: '#whitepaper' },
    { label: t.navGetStarted, href: '#getting-started' },
    { label: t.navContact, href: '#contact' },
  ]

  return (
    <YStack
      backgroundColor="$primary"
      paddingVertical="$6"
      paddingHorizontal="$4"
      alignItems="center"
    >
      <Container maxWidth={1250} width="100%">
        <XStack
          width="100%"
          justifyContent="space-between"
          alignItems="center"
          gap="$4"
          flexWrap="wrap"
        >
          <Paragraph
            fontSize="$2"
            color="$white"
            textAlign="left"
            opacity={0.9}
            flex={1}
            minWidth={240}
          >
            {t.footerText}
          </Paragraph>

          <XStack gap="$5" alignItems="center" justifyContent="flex-end" flexWrap="wrap">
            <XStack
              gap="$4"
              alignItems="center"
              justifyContent="flex-end"
              flexWrap="wrap"
            >
              {navItems.map((item) => (
                <Anchor
                  key={item.href}
                  href={item.href}
                  color="$white"
                  textDecorationLine="none"
                  fontSize="$2"
                  fontWeight="700"
                  opacity={0.95}
                  hoverStyle={{
                    opacity: 1,
                    textDecorationLine: 'underline',
                  }}
                >
                  {item.label}
                </Anchor>
              ))}
            </XStack>

            <YStack
              width={54}
              height={54}
              backgroundColor="$white"
              aria-label="Shift logo"
              style={{
                WebkitMaskImage: 'url("/isotipo%20b.svg")',
                maskImage: 'url("/isotipo%20b.svg")',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskSize: 'cover',
                maskSize: 'cover',
                WebkitMaskPosition: 'center center',
                maskPosition: 'center center',
              }}
            />
          </XStack>
        </XStack>
      </Container>
    </YStack>
  )
}
