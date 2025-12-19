'use client'

import React from 'react'
import { YStack, Heading, Paragraph } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Hero() {
  const t = useTranslations()

  return (
    <YStack
      backgroundColor="$backgroundLight"
      paddingTop={120}
      paddingBottom={120}
      paddingHorizontal="$4"
      alignItems="center"
      style={{
        backgroundImage:
          'linear-gradient(rgba(246, 240, 225, 0.5), rgba(246, 240, 225, 0.5)), url("/hero-background.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Container maxWidth={1250} width="100%">
        <YStack alignItems="center" gap="$4">
          <Heading
            size="$12"
            fontSize="$12"
            fontWeight="700"
            fontFamily="$heading"
            color="$color"
            textAlign="center"
            maxWidth={900}
            lineHeight={72}
          >
            {t.heroTitle}
          </Heading>
          
          <Paragraph
            fontSize="$7"
            fontWeight="600"
            color="$colorHover"
            textAlign="center"
          >
            {t.heroSubtitle}
          </Paragraph>
          
          <Paragraph
            fontSize="$4"
            color="$colorHover"
            textAlign="center"
            maxWidth={800}
          >
            {t.heroDescription}
          </Paragraph>
          
          <Paragraph
            fontSize="$3"
            color="$colorHover"
            textAlign="center"
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
