'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../lib/i18n/I18nContext'

export default function GettingStarted() {
  const t = useTranslations()

  const sections = [
    {
      title: t.gettingStarted1Title,
      description: t.gettingStarted1Description,
    },
    {
      title: t.gettingStarted2Title,
      description: t.gettingStarted2Description,
    },
    {
      title: t.gettingStarted3Title,
      description: t.gettingStarted3Description,
    },
  ]

  return (
    <YStack
      backgroundColor="$backgroundLight"
      paddingVertical="$10"
      paddingHorizontal="$4"
    >
      <Container maxWidth={1250} width="100%">
        <YStack gap="$6">
          <Heading
            fontSize="$9"
            fontWeight="700"
            color="$textDark"
            textAlign="center"
          >
            {t.gettingStartedTitle}
          </Heading>
          
          <XStack
            flexWrap="wrap"
            gap="$4"
            justifyContent="center"
          >
            {sections.map((section, index) => (
              <Card
                key={index}
                flex={1}
                minWidth={300}
                maxWidth={380}
                backgroundColor="$white"
                padding="$5"
                borderRadius="$3"
                elevation="$1"
              >
                <YStack gap="$3">
                  <Heading fontSize="$5" fontWeight="600" color="$textDark">
                    {section.title}
                  </Heading>
                  
                  <Paragraph
                    fontSize="$2"
                    color="$textMedium"
                    lineHeight="$4"
                  >
                    {section.description}
                  </Paragraph>
                </YStack>
              </Card>
            ))}
          </XStack>
        </YStack>
      </Container>
    </YStack>
  )
}
