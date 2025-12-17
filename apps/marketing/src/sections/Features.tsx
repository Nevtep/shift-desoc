'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

const ValueSystemIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={35} height={35}>
    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="2" fill="white"/>
  </svg>
)

const GovernanceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={35} height={35}>
    <path d="M3 21h18v-2H3v2zM19 8h-4V5c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v3H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2z" fill="white"/>
  </svg>
)

const MarketplaceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={35} height={35}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="white"/>
  </svg>
)

const TreasuryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={35} height={35}>
    <rect x="3" y="3" width="6" height="6" fill="white"/>
    <rect x="3" y="9" width="6" height="6" fill="white"/>
    <rect x="9" y="3" width="6" height="6" fill="white"/>
    <rect x="9" y="9" width="6" height="6" fill="white"/>
  </svg>
)

const ReputationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={35} height={35}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
  </svg>
)

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={35} height={35}>
    <path d="M13 3L4 14h7v7l9-11h-7V3z" fill="white"/>
  </svg>
)

export default function Features() {
  const t = useTranslations()

  const features = [
    {
      icon: <ValueSystemIcon />,
      title: t.feature1Title,
      description: t.feature1Description,
    },
    {
      icon: <GovernanceIcon />,
      title: t.feature2Title,
      description: t.feature2Description,
    },
    {
      icon: <MarketplaceIcon />,
      title: t.feature3Title,
      description: t.feature3Description,
    },
    {
      icon: <TreasuryIcon />,
      title: t.feature4Title,
      description: t.feature4Description,
    },
    {
      icon: <ReputationIcon />,
      title: t.feature5Title,
      description: t.feature5Description,
    },
    {
      icon: <VerifiedIcon />,
      title: t.feature6Title,
      description: t.feature6Description,
    },
  ]

  return (
    <YStack
      backgroundColor="$background"
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
            {t.featuresTitle}
          </Heading>
          
          <XStack
            flexWrap="wrap"
            gap="$4"
            justifyContent="center"
          >
            {features.map((feature, index) => (
              <Card
                key={index}
                flex={1}
                minWidth={300}
                maxWidth={380}
                backgroundColor="$white"
                padding="$5"
                borderRadius="$3"
                elevation="$1"
                alignItems="center"
                hoverStyle={{
                  elevation: '$2',
                  scale: 1.05,
                  y: -5,
                }}
              >
                <YStack gap="$4" alignItems="center">
                  <YStack
                    width={70}
                    height={70}
                    borderRadius="$2"
                    backgroundColor="$secondary"
                    alignItems="center"
                    justifyContent="center"
                    marginBottom="$3"
                  >
                    {feature.icon}
                  </YStack>
                  
                  <Heading fontSize="$5" fontWeight="600" color="$textDark" textAlign="center">
                    {feature.title}
                  </Heading>
                  
                  <Paragraph
                    fontSize="$2"
                    color="$textMedium"
                    textAlign="center"
                    lineHeight="$4"
                  >
                    {feature.description}
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
