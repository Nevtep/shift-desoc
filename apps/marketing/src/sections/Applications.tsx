'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../lib/i18n/I18nContext'

const PlaceholderImage = () => (
  <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
    <rect width="200" height="120" fill="#E0E0D0" rx="4"/>
    <path d="M50 80 L80 50 L120 60 L150 40 L170 70" stroke="#8B8B7A" strokeWidth="2" fill="none"/>
    <circle cx="170" cy="30" r="15" fill="#FFD54F"/>
  </svg>
)

export default function Applications() {
  const t = useTranslations()

  const applications = [
    {
      title: t.application1Title,
      description: t.application1Description,
    },
    {
      title: t.application2Title,
      description: t.application2Description,
    },
    {
      title: t.application3Title,
      description: t.application3Description,
    },
    {
      title: t.application4Title,
      description: t.application4Description,
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
            {t.applicationsTitle}
          </Heading>
          
          <XStack
            flexWrap="wrap"
            gap="$4"
            justifyContent="center"
          >
            {applications.map((app, index) => (
              <Card
                key={index}
                flex={1}
                minWidth={250}
                maxWidth={300}
                backgroundColor="$white"
                borderRadius="$3"
                overflow="hidden"
                elevation="$1"
                hoverStyle={{
                  elevation: '$2',
                  scale: 1.05,
                  y: -5,
                }}
              >
                <YStack>
                  <YStack
                    width="100%"
                    height={180}
                    backgroundColor="$greyLight"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <PlaceholderImage />
                  </YStack>
                  
                  <YStack padding="$4" gap="$2">
                    <Heading fontSize="$5" fontWeight="600" color="$textDark">
                      {app.title}
                    </Heading>
                    
                    <Paragraph
                      fontSize="$2"
                      color="$textMedium"
                      lineHeight="$4"
                    >
                      {app.description}
                    </Paragraph>
                  </YStack>
                </YStack>
              </Card>
            ))}
          </XStack>
        </YStack>
      </Container>
    </YStack>
  )
}
