'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../lib/i18n/I18nContext'

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={40} height={40}>
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
  </svg>
)

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={40} height={40}>
    <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" fill="white"/>
  </svg>
)

const DollarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={40} height={40}>
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.38-1.9 1.38-1.66 0-2.52-.92-2.6-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill="white"/>
  </svg>
)

export default function Principles() {
  const t = useTranslations()

  const principles = [
    {
      icon: <CheckIcon />,
      title: t.principle1Title,
      subtitle: t.principle1Subtitle,
      description: t.principle1Description,
    },
    {
      icon: <FolderIcon />,
      title: t.principle2Title,
      subtitle: t.principle2Subtitle,
      description: t.principle2Description,
    },
    {
      icon: <DollarIcon />,
      title: t.principle3Title,
      subtitle: t.principle3Subtitle,
      description: t.principle3Description,
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
            {t.principlesTitle}
          </Heading>
          
          <XStack
            flexWrap="wrap"
            gap="$6"
            justifyContent="center"
          >
            {principles.map((principle, index) => (
              <Card
                key={index}
                flex={1}
                minWidth={300}
                maxWidth={400}
                backgroundColor="$white"
                padding="$6"
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
                    width={80}
                    height={80}
                    borderRadius={40}
                    backgroundColor="$primary"
                    alignItems="center"
                    justifyContent="center"
                    marginBottom="$4"
                  >
                    {principle.icon}
                  </YStack>
                  
                  <Heading fontSize="$5" fontWeight="600" color="$textDark" textAlign="center">
                    {principle.title}
                  </Heading>
                  
                  <Paragraph
                    fontSize="$3"
                    fontWeight="500"
                    color="$primaryDark"
                    textAlign="center"
                  >
                    {principle.subtitle}
                  </Paragraph>
                  
                  <Paragraph
                    fontSize="$2"
                    color="$textMedium"
                    textAlign="center"
                    lineHeight="$4"
                  >
                    {principle.description}
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
