'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function WhyBlockchain() {
  const t = useTranslations()

  return (
    <YStack
      id="whitepaper"
      backgroundColor="$background"
      paddingVertical="$10"
      paddingHorizontal="$4"
    >
      <Container maxWidth={1250} width="100%">
        <XStack
          flexWrap="wrap"
          gap="$6"
          justifyContent="center"
        >
          <Card
            flex={1}
            minWidth={450}
            maxWidth={600}
            backgroundColor="$white"
            padding="$6"
            borderRadius="$3"
            elevation="$1"
          >
            <YStack gap="$4">
              <Heading fontSize="$7" fontWeight="700" color="$textDark">
                {t.whyTitle}
              </Heading>
              
              <Paragraph fontSize="$6" fontWeight="600" color="$textDark">
                {t.whyStatement}
              </Paragraph>
              
              <Heading fontSize="$5" fontWeight="600" color="$textDark" marginTop="$4">
                {t.whyPlatformsTitle}
              </Heading>
              
              <Paragraph fontSize="$3" color="$textMedium" lineHeight="$5">
                {t.whyPlatformsDescription}
              </Paragraph>
            </YStack>
          </Card>
          
          <Card
            flex={1}
            minWidth={450}
            maxWidth={600}
            backgroundColor="$white"
            padding="$6"
            borderRadius="$3"
            elevation="$1"
          >
            <YStack gap="$4">
              <Heading fontSize="$7" fontWeight="700" color="$textDark">
                {t.futureTitle}
              </Heading>
              
              <Paragraph fontSize="$6" fontWeight="600" color="$textDark">
                {t.futureStatement1}
              </Paragraph>
              
              <Paragraph fontSize="$6" fontWeight="600" color="$textDark">
                {t.futureStatement2}
              </Paragraph>
              
              <Paragraph fontSize="$3" color="$textMedium" lineHeight="$5" marginTop="$2">
                {t.futureWhyDescription}
              </Paragraph>
            </YStack>
          </Card>
        </XStack>
      </Container>
    </YStack>
  )
}
