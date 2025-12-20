'use client'

import React from 'react'
import { Anchor, Heading, Paragraph, XStack, YStack } from 'tamagui'
import { BookOpen } from 'lucide-react'
import { Container } from '../components/Container'
import { useLanguage, useTranslations } from '../providers/i18n/I18nContext'

const WHITEPAPER_LINKS = {
  es: 'https://gist.github.com/Nevtep/3c7989ccdf7201faf957834f505b4cb0',
  en: 'https://gist.github.com/Nevtep/39db8e00460c976c09332a5e67ac594b',
} as const

export default function Whitepaper() {
  const t = useTranslations()
  const [language] = useLanguage()
  const whitepaperHref = WHITEPAPER_LINKS[language] ?? WHITEPAPER_LINKS.es

  return (
    <YStack
      id="whitepaper"
      backgroundColor="$white"
      paddingTop={80}
      paddingBottom={80}
      paddingHorizontal="$4"
      borderTopWidth={1}
      borderBottomWidth={1}
      borderColor="#0f0f0f"
    >
      <Container maxWidth={1100} width="100%">
        <YStack
          backgroundColor="#ffffff"
          borderRadius="$4"
          padding="$8"
          paddingTop={40}
          paddingBottom={20}
          gap="$5"
          alignItems="center"
          justifyContent="center"
          borderWidth={1}
          borderColor="#0f0f0f"
          style={{
            boxShadow: '0 18px 42px rgba(0,0,0,0.08)',
          }}
        >
          <Heading
            fontSize="$11"
            fontWeight="800"
            color="#0f0f0f"
            textAlign="center"
            letterSpacing={-0.5}
          >
            {t.whitepaperTitle}
          </Heading>

          <Paragraph
            fontSize="$5"
            color="#1f1f1f"
            textAlign="center"
            maxWidth={820}
            lineHeight={28}
          >
            {t.whitepaperDescription}
          </Paragraph>

          <YStack
            gap="$2.5"
            padding="$2"
            width="100%"
            maxWidth={760}
            alignSelf="center"
          >
            <Heading
              fontSize="$7"
              fontWeight="800"
              color="#0f0f0f"
              letterSpacing={-0.2}
            >
              {t.whitepaperWhyTitle}
            </Heading>

            <Paragraph fontSize="$5" color="#1f1f1f" fontWeight="700">
              {t.whitepaperWhySubtitle}
            </Paragraph>

            <Paragraph fontSize="$4" color="#2c2c2c" lineHeight={26}>
              {t.whitepaperWhyP1}
            </Paragraph>
            <Paragraph fontSize="$4" color="#2c2c2c" lineHeight={26}>
              {t.whitepaperWhyP2}
            </Paragraph>
            <Paragraph fontSize="$4" color="#2c2c2c" lineHeight={26}>
              {t.whitepaperWhyP3}
            </Paragraph>
          </YStack>

          <Anchor
            href={whitepaperHref}
            target="_blank"
            rel="noopener noreferrer"
            backgroundColor="#0f0f0f"
            paddingVertical="$4"
            paddingHorizontal="$6"
            borderRadius="$4"
            textDecorationLine="none"
            hoverStyle={{
              backgroundColor: '#1b1b1b',
              scale: 1.03,
              y: -3,
            }}
            pressStyle={{
              scale: 0.97,
            }}
          >
            <XStack gap="$3" alignItems="center" justifyContent="center">
              <BookOpen size={26} color="#ffffff" strokeWidth={2.4} />
              <Paragraph
                fontSize="$5"
                fontWeight="700"
                color="#ffffff"
                textTransform="uppercase"
                letterSpacing={0.8}
              >
                {t.whitepaperCTA}
              </Paragraph>
            </XStack>
          </Anchor>

          <Paragraph
            fontSize="$3"
            color="#3a3a3a"
            textAlign="center"
            maxWidth={720}
          >
            {t.whitepaperNote}
          </Paragraph>
        </YStack>
      </Container>
    </YStack>
  )
}

