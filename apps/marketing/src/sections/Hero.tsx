'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Hero() {
  const t = useTranslations()

  return (
    <YStack
      backgroundColor="$backgroundLight"
      paddingTop="$16"
      paddingBottom="$10"
      paddingHorizontal="$4"
      alignItems="center"
    >
      <Container maxWidth={1250} width="100%">
        <YStack alignItems="center" gap="$4">
          <Heading
            fontSize="$10"
            fontWeight="700"
            color="$color"
            textAlign="center"
            maxWidth={900}
            lineHeight="$10"
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
          
          <XStack
            marginTop="$6"
            maxWidth={600}
            width="100%"
            backgroundColor="$greyLight"
            borderRadius="$2"
            padding="$4"
          >
            <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
              <rect width="200" height="120" fill="#E0E0D0" rx="4"/>
              <path d="M50 80 L80 50 L120 60 L150 40 L170 70" stroke="#8B8B7A" strokeWidth="2" fill="none"/>
              <circle cx="170" cy="30" r="15" fill="#FFD54F"/>
            </svg>
          </XStack>
        </YStack>
      </Container>
    </YStack>
  )
}
