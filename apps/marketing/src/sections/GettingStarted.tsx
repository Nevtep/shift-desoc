'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card, Anchor } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function GettingStarted() {
  const t = useTranslations()

  const cards = [
    {
      title: t.gettingStarted1Title,
      description: t.gettingStarted1Description,
      primaryCta: t.gettingStarted1PrimaryCta,
      secondaryCta: t.gettingStarted1SecondaryCta,
      secondaryHref: 'https://github.com/Nevtep/shift-desoc',
      gradient: 'linear-gradient(135deg, #DD8848 0%, #6C8158 100%)',
    },
    {
      title: t.gettingStarted2Title,
      description: t.gettingStarted2Description,
      primaryCta: t.gettingStarted2PrimaryCta,
      secondaryCta: t.gettingStarted2SecondaryCta,
      secondaryHref: 'https://calendly.com/shiftdesoc/30min',
      gradient: 'linear-gradient(135deg, #566645 0%, #B23B3B 100%)',
    },
    {
      title: t.gettingStarted3Title,
      description: t.gettingStarted3Description,
      primaryCta: t.gettingStarted3PrimaryCta,
      secondaryCta: t.gettingStarted3SecondaryCta,
      secondaryHref: 'https://calendly.com/shiftdesoc/30min',
      gradient: 'linear-gradient(135deg, #c4733c 0%, #566645 100%)',
    },
  ]

  const ctaButtonStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    color: '#FFFFFF',
    borderRadius: '$3',
    paddingVertical: '$3',
    paddingHorizontal: '$4',
    fontSize: '$3',
    fontWeight: '700',
    textDecorationLine: 'none',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    hoverStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.24)',
      scale: 1.02,
      y: -2,
    },
    pressStyle: {
      scale: 0.98,
    },
  } as const

  return (
    <YStack
      id="getting-started"
      backgroundColor="$backgroundLight"
      paddingVertical={80}
      paddingHorizontal="$4"
      style={{
        // Evita que el header fijo tape el inicio de la sección al hacer scroll con anclas
        scrollMarginTop: 140,
      }}
    >
      <Container maxWidth={1250} width="100%">
        <YStack gap="$6">
          <Heading
            fontSize="$11"
            fontWeight="700"
            color="$primary"
            textAlign="center"
          >
            {t.gettingStartedTitle}
          </Heading>

          <Paragraph
            fontSize="$8"
            fontWeight="600"
            color="$secondary"
            textAlign="center"
          >
            {t.ctaTitle}
          </Paragraph>

          <XStack
            flexWrap="wrap"
            gap="$4"
            justifyContent="center"
          >
            {cards.map((card, index) => (
              <Card
                key={index}
                flex={1}
                minWidth={300}
                maxWidth={400}
                padding="$5"
                borderRadius="$4"
                elevation="$2"
                backgroundColor="$primary"
                borderWidth={1}
                borderColor="rgba(255, 255, 255, 0.15)"
                style={{
                  backgroundImage: card.gradient,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <YStack gap="$4" height="100%" justifyContent="space-between">
                  <YStack gap="$3">
                    <Heading fontSize="$6" fontWeight="800" color="$white">
                      {card.title}
                    </Heading>

                    <Paragraph
                      fontSize="$2"
                      color="rgba(255, 255, 255, 0.9)"
                      lineHeight="$4"
                    >
                      {card.description}
                    </Paragraph>
                  </YStack>

                  <XStack gap="$3" flexWrap="nowrap" justifyContent="flex-start">
                    {/* CTA principal comentado para habilitar en el futuro
                    <Anchor href="#contact" {...ctaButtonStyle}>
                      {card.primaryCta}
                    </Anchor>
                    */}
                    <Anchor
                    href={card.secondaryHref}
                      {...ctaButtonStyle}
                      backgroundColor="rgba(255, 255, 255, 0.1)"
                    target="_blank"
                    rel="noopener noreferrer"
                    >
                      {card.secondaryCta}
                    </Anchor>
                  </XStack>
                </YStack>
              </Card>
            ))}
          </XStack>
        </YStack>
      </Container>
    </YStack>
  )
}
