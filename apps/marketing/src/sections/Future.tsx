'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../lib/i18n/I18nContext'

export default function Future() {
  const t = useTranslations()

  const futureItems = [
    t.future1,
    t.future2,
    t.future3,
    t.future4,
    t.future5,
  ]

  return (
    <YStack
      backgroundColor="$background"
      paddingVertical="$10"
      paddingHorizontal="$4"
      alignItems="center"
    >
      <Container maxWidth={1250} width="100%">
        <YStack gap="$6" alignItems="center">
          <Heading
            fontSize="$9"
            fontWeight="700"
            color="$textDark"
            textAlign="center"
          >
            {t.futureSectionTitle}
          </Heading>
          
          <Paragraph
            fontSize="$5"
            color="$textDark"
            textAlign="center"
            maxWidth={800}
          >
            {t.futureIntro}
          </Paragraph>
          
          <YStack gap="$4" maxWidth={800} width="100%">
            {futureItems.map((item, index) => (
              <XStack key={index} gap="$3" alignItems="flex-start">
                <Paragraph fontSize="$4" color="$primary" marginTop="$1">
                  →
                </Paragraph>
                <Paragraph fontSize="$4" color="$textMedium" lineHeight="$6" flex={1}>
                  {item}
                </Paragraph>
              </XStack>
            ))}
          </YStack>
          
          <Paragraph
            fontSize="$5"
            fontWeight="600"
            color="$textDark"
            textAlign="center"
            maxWidth={800}
            marginTop="$4"
          >
            {t.futureStatement}
          </Paragraph>
          
          <Paragraph
            fontSize="$3"
            color="$textMedium"
            textAlign="center"
            maxWidth={800}
            lineHeight="$6"
          >
            {t.futureDescription}
          </Paragraph>
        </YStack>
      </Container>
    </YStack>
  )
}
