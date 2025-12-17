'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Button } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../lib/i18n/I18nContext'

export default function CTA() {
  const t = useTranslations()

  return (
    <YStack
      backgroundColor="$backgroundLight"
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
            {t.ctaTitle}
          </Heading>
          
          <Paragraph
            fontSize="$6"
            fontWeight="600"
            color="$textDark"
            textAlign="center"
            maxWidth={900}
          >
            {t.ctaStatement}
          </Paragraph>
          
          <Paragraph
            fontSize="$4"
            color="$textMedium"
            textAlign="center"
            maxWidth={800}
          >
            {t.ctaDescription}
          </Paragraph>
          
          <Paragraph
            fontSize="$3"
            color="$textMedium"
            textAlign="center"
            fontStyle="italic"
            maxWidth={700}
          >
            {t.ctaQuestion}
          </Paragraph>
          
          <XStack
            flexWrap="wrap"
            gap="$4"
            justifyContent="center"
            marginTop="$4"
          >
            <Button
              size="$4"
              backgroundColor="$primary"
              color="$white"
              borderRadius="$2"
              paddingHorizontal="$6"
              paddingVertical="$4"
              fontWeight="600"
              hoverStyle={{
                backgroundColor: '$primaryDark',
                scale: 1.05,
                y: -2,
              }}
              pressStyle={{
                scale: 0.95,
              }}
            >
              {t.btnLearnMore}
            </Button>
            
            <Button
              size="$4"
              backgroundColor="$secondary"
              color="$white"
              borderRadius="$2"
              paddingHorizontal="$6"
              paddingVertical="$4"
              fontWeight="600"
              hoverStyle={{
                backgroundColor: '$secondaryDark',
                scale: 1.05,
                y: -2,
              }}
              pressStyle={{
                scale: 0.95,
              }}
            >
              {t.btnJoinCommunity}
            </Button>
            
            <Button
              size="$4"
              backgroundColor="transparent"
              borderWidth={2}
              borderColor="$textDark"
              borderRadius="$2"
              paddingHorizontal="$6"
              paddingVertical="$4"
              fontWeight="600"
              textProps={{
                color: '$textDark',
                hoverStyle: {
                  color: '$white',
                },
              }}
              hoverStyle={{
                backgroundColor: '$textDark',
                scale: 1.05,
                y: -2,
              }}
              pressStyle={{
                scale: 0.95,
              }}
            >
              {t.btnStartBuilding}
            </Button>
          </XStack>
          
          <Paragraph
            fontSize="$4"
            color="$textMedium"
            textAlign="center"
            fontStyle="italic"
            marginTop="$6"
          >
            {t.ctaTagline} 🌟
          </Paragraph>
        </YStack>
      </Container>
    </YStack>
  )
}
