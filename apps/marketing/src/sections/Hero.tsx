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
          <YStack gap={0} alignItems="flex-start">
            <Heading
              size="$12"
              fontSize="$12"
              fontWeight="700"
              fontFamily="$heading"
              color="#6C8158"
              textAlign="left"
              lineHeight={64}
              display="block"
            >
              {t.heroTitleLine1}
            </Heading>
            <Heading
              size="$12"
              fontSize="$12"
              fontWeight="700"
              fontFamily="$heading"
              color="#DD8848"
              textAlign="left"
              lineHeight={64}
              display="block"
            >
              {t.heroTitleLine2}
            </Heading>
          </YStack>

          <Paragraph
            fontSize="$8"
            fontWeight="400"
            color="#6C8158"
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

        </YStack>
      </Container>
    </YStack>
  )
}
