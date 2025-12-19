'use client'

import React from 'react'
import Link from 'next/link'
import { YStack, Heading, Paragraph, Button, XStack } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Hero() {
  const t = useTranslations()

  return (
    <YStack
      id="home"
      backgroundColor="$backgroundLight"
      paddingTop={160}
      paddingBottom={140}
      paddingHorizontal="$4"
      alignItems="stretch"
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(246, 240, 225, 0.92), rgba(246, 240, 225, 0.86)), url("/hero-backgound2.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderBottom: '1px solid rgba(224, 224, 208, 0.7)',
      }}
    >
      <Container maxWidth={1250} width="100%">
        <YStack alignItems="flex-start" gap="$4" maxWidth={760}>
          <Heading
            size="$12"
            fontSize="$12"
            fontWeight="700"
            fontFamily="$heading"
            color="$color"
            textAlign="left"
            lineHeight={64}
          >
            {t.heroTitle}
          </Heading>

          <Paragraph
            fontSize="$7"
            fontWeight="700"
            color="$secondaryDark"
            textAlign="left"
          >
            {t.heroSubtitle}
          </Paragraph>

          <Paragraph
            fontSize="$5"
            color="$color"
            textAlign="left"
            maxWidth={820}
            lineHeight={28}
          >
            {t.heroDescription}
          </Paragraph>

          <XStack gap="$3" alignItems="center" marginTop="$2">
            <Button
              asChild
              size="$5"
              borderRadius="$3"
              backgroundColor="$secondary"
              color="$white"
              paddingHorizontal="$5"
              hoverStyle={{ backgroundColor: '$secondaryDark' }}
            >
              <Link href="#contact">{t.navGetStarted}</Link>
            </Button>

            <Button
              asChild
              size="$5"
              borderRadius="$3"
              backgroundColor="transparent"
              color="$color"
              borderWidth={2}
              borderColor="$secondary"
              paddingHorizontal="$5"
              hoverStyle={{ borderColor: '$secondaryDark' }}
              textProps={{ color: '$color', hoverStyle: { color: '$secondaryDark' } }}
            >
              <Link href="#solutions">{t.btnLearnMore}</Link>
            </Button>
          </XStack>

          <Paragraph
            fontSize="$3"
            color="$colorHover"
            textAlign="left"
            maxWidth={800}
            fontStyle="italic"
          >
            {t.heroStatement}
          </Paragraph>
        </YStack>
      </Container>
    </YStack>
  )
}
