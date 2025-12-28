'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card, Image } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'

export default function Principles() {
  const t = useTranslations()
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>()

  const principles = [
    {
      image: '/principles-contribulle.webp',
      title: t.principle1Title,
      subtitle: t.principle1Subtitle,
      description: t.principle1Description,
    },
    {
      image: '/principles-manos.webp',
      title: t.principle2Title,
      subtitle: t.principle2Subtitle,
      description: t.principle2Description,
    },
    {
      image: '/principles-valor.webp',
      title: t.principle3Title,
      subtitle: t.principle3Subtitle,
      description: t.principle3Description,
    },
  ]

  return (
    <YStack
      id="principles"
      backgroundColor="#ede3cf"
      paddingVertical={0}
      paddingHorizontal={0}
      width="100%"
    >
      <Container maxWidth={1250} width="100%" paddingHorizontal={0}>
        <YStack
          width="100%"
          padding="$6"
          position="relative"
          overflow="hidden"
          style={{
            backgroundColor: '#ede3cf',
          }}
          minHeight={720}
          justifyContent="center"
        >
          <YStack gap="$3" alignItems="center" position="relative" zIndex={1} paddingVertical={40}>
            <Heading
              fontSize="$11"
              fontWeight="700"
              color="$primary"
              textAlign="center"
            >
              {t.navPrinciples}
            </Heading>
            <Paragraph
              fontSize="$8"
              fontWeight="700"
              color="$secondary"
              textAlign="center"
              maxWidth={800}
              marginBottom={30}
            >
              {t.principlesTitle}
            </Paragraph>
            
            <XStack
              flexWrap="wrap"
              gap="$6"
              justifyContent="center"
              width="100%"
              marginTop={0}
              ref={ref}
            >
              {principles.map((principle, index) => (
                <Card
                  key={index}
                  flex={1}
                  minWidth={320}
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
                  className={`reveal reveal-up ${visible ? 'is-visible' : ''} ${index === 1 ? 'reveal-delay-1' : index === 2 ? 'reveal-delay-2' : ''}`}
                >
                  <YStack gap="$4" alignItems="center">
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
                        source={{ uri: principle.image }}
                        width={120}
                        height={120}
                        resizeMode="cover"
                        alt={principle.title}
                      />
                    </YStack>
                    
                    <Heading fontSize="$7" fontWeight="700" color="$secondary" textAlign="center">
                      {principle.title}
                    </Heading>
                    
                    <Paragraph
                      fontSize="$3"
                      fontWeight="600"
                      color="$primaryDark"
                      textAlign="center"
                    >
                      {principle.subtitle}
                    </Paragraph>
                    
                    <Paragraph
                      fontSize="$3"
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
        </YStack>
      </Container>
    </YStack>
  )
}
