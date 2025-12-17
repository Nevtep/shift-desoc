'use client'

import React from 'react'
import { YStack, Paragraph } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Footer() {
  const t = useTranslations()

  return (
    <YStack
      backgroundColor="$textDark"
      paddingVertical="$6"
      paddingHorizontal="$4"
      alignItems="center"
    >
      <Container maxWidth={1250} width="100%">
        <Paragraph
          fontSize="$2"
          color="$white"
          textAlign="center"
          opacity={0.8}
        >
          {t.footerText}
        </Paragraph>
      </Container>
    </YStack>
  )
}
