'use client'

import React from 'react'
import { YStack, Heading, Paragraph, XStack, Anchor } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'
import { secondaryGradientButton, secondaryOutlineButton } from '../components/buttonStyles'

export default function Hero() {
  const t = useTranslations()

  return (
    <YStack
      id="home"
      backgroundColor="$backgroundLight"
      width="100%"
      paddingTop={160}
      paddingBottom={50}
      paddingHorizontal="$4"
      alignItems="stretch"
      style={{
        backgroundImage:
          'linear-gradient(135deg, #F6F0E1 0%, #F6F0E1 45%, rgba(246, 240, 225, 0) 75%), url("/hero-backgound2.png")',
        backgroundSize: 'cover, cover',
        backgroundPosition: 'left top, left bottom',
        backgroundRepeat: 'no-repeat, no-repeat',
        maxWidth: 1250,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <Container maxWidth={1250} width="100%">
        <YStack alignItems="flex-start" gap="$4" maxWidth="60%" width="100%">
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
            <Anchor
              href="#contact"
              {...secondaryGradientButton}
            >
              {t.navGetStarted}
            </Anchor>

            <Anchor
              href="#solutions"
              {...secondaryOutlineButton}
            >
              {t.btnLearnMore}
            </Anchor>
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
