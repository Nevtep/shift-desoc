'use client'

import React from 'react'
import { YStack, Paragraph, XStack, Anchor, Image, useMedia } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Footer() {
  const t = useTranslations()
  const media = useMedia()

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
        {media.md ? (
          <YStack width="100%" alignItems="center" gap="$4">
            <Paragraph
              fontSize="$2"
              color="$white"
              textAlign="center"
              opacity={0.9}
              flex={1}
              minWidth={240}
            >
              {t.footerText}
            </Paragraph>

            <Image
              source={{ uri: '/imagotipo h b.svg' }}
              width={180}
              height={60}
              resizeMode="contain"
              alt="Shift logo"
            />
          </YStack>
        ) : (
          <XStack
            width="100%"
            alignItems="center"
            justifyContent="space-between"
            gap="$6"
            flexWrap="nowrap"
          >
            <Paragraph
              fontSize="$2"
              color="$white"
              textAlign="left"
              opacity={0.9}
              flexShrink={0}
            >
              {t.footerText}
            </Paragraph>

            <XStack
              gap="$4"
              alignItems="center"
              justifyContent="center"
              flexWrap="nowrap"
              flex={1}
              paddingHorizontal="$4"
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
                  flexShrink={0}
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
              flexShrink={0}
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
        )}
      </Container>
    </YStack>
  )
}
