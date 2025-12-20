'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card, Image } from 'tamagui'
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
      image: '/solutions-value.webp',
      description: [t.feature1Bullet1, t.feature1Bullet2, t.feature1Bullet3],
    },
    {
      icon: <GovernanceIcon />,
      title: t.feature2Title,
      image: '/solutions-governance.webp',
      description: [t.feature2Bullet1, t.feature2Bullet2, t.feature2Bullet3],
    },
    {
      icon: <MarketplaceIcon />,
      title: t.feature3Title,
      image: '/solutions-market.webp',
      description: [t.feature3Bullet1, t.feature3Bullet2, t.feature3Bullet3],
    },
    {
      icon: <TreasuryIcon />,
      title: t.feature4Title,
      image: '/solutions-treasury.webp',
      description: [t.feature4Bullet1, t.feature4Bullet2, t.feature4Bullet3],
    },
    {
      icon: <ReputationIcon />,
      title: t.feature5Title,
      image: '/solutions-reputation.webp',
      description: [t.feature5Bullet1, t.feature5Bullet2, t.feature5Bullet3],
    },
    {
      icon: <VerifiedIcon />,
      title: t.feature6Title,
      image: '/solutions-peerreview.webp',
      description: [t.feature6Bullet1, t.feature6Bullet2, t.feature6Bullet3],
    },
  ]

  const BulletIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="5" fill="#6C8158" />
    </svg>
  )

  return (
    <YStack
      id="solutions"
      backgroundColor="$background"
      paddingVertical="$10"
      paddingHorizontal="$4"
    >
      <Container maxWidth={1250} width="100%">
        <YStack gap="$6" alignItems="center">
          <YStack gap="$3" alignItems="center">
            <Heading
              fontSize="$10"
              fontWeight="700"
              color="$primary"
              textAlign="center"
            >
              {t.navSolutions}
            </Heading>
            <Paragraph
              fontSize="$8"
              fontWeight="700"
              color="$secondary"
              textAlign="center"
              maxWidth={900}
            >
              {t.featuresTitle}
            </Paragraph>
          </YStack>

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
                backgroundColor="rgba(246, 240, 225, 0.88)"
                padding="$6"
                borderRadius="$4"
                elevation="$2"
                alignItems="center"
                hoverStyle={{
                  elevation: '$3',
                  scale: 1.03,
                  y: -4,
                }}
                borderWidth={1}
                borderColor="rgba(86, 102, 69, 0.15)"
              >
                <YStack gap="$4" alignItems="center" width="100%">
                  <YStack
                    width={120}
                    height={120}
                    borderRadius={80}
                    overflow="hidden"
                    backgroundColor="rgba(0,0,0,0.04)"
                    alignItems="center"
                    justifyContent="center"
                    marginBottom="$3"
                  >
                    <Image
                      source={{ uri: feature.image }}
                      width={120}
                      height={120}
                      resizeMode="cover"
                      alt={feature.title}
                    />
                  </YStack>

                  <Heading fontSize="$6" fontWeight="700" color="$secondary" textAlign="center">
                    {feature.title}
                  </Heading>
                  
                  <YStack gap="$2" width="100%">
                    {feature.description.map((line, lineIndex) => (
                      <XStack
                        key={lineIndex}
                        gap="$2"
                        alignItems="flex-start"
                        justifyContent="center"
                      >
                        <YStack marginTop={4}>
                          <BulletIcon />
                        </YStack>
                        <Paragraph
                          fontSize="$3"
                          color="$textMedium"
                          textAlign="left"
                          lineHeight="$4"
                          flex={1}
                          style={{ whiteSpace: 'pre-line' }}
                        >
                          {line}
                        </Paragraph>
                      </XStack>
                    ))}
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
