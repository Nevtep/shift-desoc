'use client'

import React, { useEffect, useState } from 'react'
import { YStack, Heading, Paragraph, XStack, Anchor } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'
import { secondaryGradientButton, secondaryOutlineButton } from '../components/buttonStyles'

const HERO_BACKGROUNDS = ['/hero-backgound.webp', '/hero-backgound2.webp', '/hero-backgound3.webp']

export default function Hero() {
  const t = useTranslations()
  const heroBackgrounds = HERO_BACKGROUNDS
  const [currentBg, setCurrentBg] = useState(0)

  useEffect(() => {
    if (heroBackgrounds.length <= 1) return undefined
    // Evita desajustes de hidratación: primera renderización igual en servidor/cliente (index 0),
    // luego se elige un fondo al azar y se inicia el ciclo.
    const initialRandom = Math.floor(Math.random() * heroBackgrounds.length)
    setCurrentBg(initialRandom)

    const intervalMs = 8000
    const id = setInterval(
      () => setCurrentBg((prev) => (prev + 1) % heroBackgrounds.length),
      intervalMs,
    )
    return () => clearInterval(id)
  }, [heroBackgrounds.length])

  const getBackgroundStyle = (src: string) => ({
    backgroundImage:
      'linear-gradient(135deg, #F6F0E1 0%, #F6F0E1 45%, rgba(246, 240, 225, 0) 75%), url("'
      + src
      + '")',
    backgroundSize: 'cover, cover',
    backgroundPosition: 'left top, left bottom',
    backgroundRepeat: 'no-repeat, no-repeat',
  })

  return (
    <YStack
      id="home"
      backgroundColor="$backgroundLight"
      width="100%"
      paddingTop={240}
      paddingBottom={100}
      paddingHorizontal="$4"
      alignItems="stretch"
      position="relative"
      overflow="hidden"
      style={{
        maxWidth: 1250,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <YStack position="absolute" inset={0} pointerEvents="none">
        {heroBackgrounds.map((src, index) => (
          <YStack
            key={src}
            position="absolute"
            inset={0}
            style={{
              ...getBackgroundStyle(src),
              opacity: index === currentBg ? 1 : 0,
              transition: 'opacity 1.2s ease-in-out',
            }}
          />
        ))}
      </YStack>

      <Container maxWidth={1250} width="100%">
        <YStack
          alignItems="flex-start"
          gap="$4"
          maxWidth="60%"
          width="100%"
          position="relative"
          zIndex={1}
        >
          <YStack gap={0} alignItems="flex-start">
            <Heading
              size="$12"
              fontSize="$12"
              fontWeight="700"
              fontFamily="$heading"
              color="#6C8158"
              textAlign="left"
              lineHeight={64}
              display="block"
            >
              {t.heroTitleLine1}
            </Heading>
            <Heading
              size="$12"
              fontSize="$12"
              fontWeight="700"
              fontFamily="$heading"
              color="#DD8848"
              textAlign="left"
              lineHeight={64}
              display="block"
            >
              {t.heroTitleLine2}
            </Heading>
          </YStack>

          <Paragraph
            fontSize="$8"
            fontWeight="400"
            color="#6C8158"
            textAlign="left"
          >
            {t.heroSubtitle}
          </Paragraph>

          <Paragraph
            fontSize="$5"
            color="$color"
            textAlign="left"
            maxWidth={820}
            lineHeight={28}
          >
            {t.heroDescription}
          </Paragraph>

          <XStack gap="$3" alignItems="center" marginTop="$2">
            <Anchor
              href="#getting-started"
              {...secondaryGradientButton}
            >
              {t.navGetStarted}
            </Anchor>

            <Anchor
              href="#about"
              {...secondaryOutlineButton}
            >
              {t.btnLearnMore}
            </Anchor>
          </XStack>

        </YStack>
      </Container>
    </YStack>
  )
}
