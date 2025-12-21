'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Image, Anchor, useMedia } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

const socialNetworks = [
  { name: 'X', image: '/social1-x.webp', href: 'https://x.com/ShiftDeSoc' },
  { name: 'Instagram', image: '/social2-instagram.webp', href: 'https://www.instagram.com/shiftdesoc/' },
  { name: 'LinkedIn', image: '/social3-linkedin.webp', href: 'https://www.linkedin.com/in/shiftdesoc/' },
  { name: 'GitHub', image: '/social4-github.webp', href: 'https://github.com/Nevtep/shift-desoc' },
]

export default function Contact() {
  const t = useTranslations()
  const media = useMedia()

  return (
    <YStack
      id="contact"
      backgroundColor="$backgroundLight"
      paddingVertical="$13"
      paddingHorizontal="$4"
      alignItems="center"
      minHeight={720}
      style={{
        backgroundImage: 'url("/contact-bg.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
      }}
    >
      <Container maxWidth={1250} width="100%">
        <YStack gap="$6" alignItems="center" justifyContent="center" height="100%">
          <Heading
            fontSize="$11"
            fontWeight="800"
            color="$primary"
            textAlign="center"
          >
            {t.contactTitle}
          </Heading>

          <Paragraph
            fontSize="$7"
            fontWeight="700"
            color="$secondary"
            textAlign="center"
            maxWidth={860}
          >
            {t.contactSubtitle}
          </Paragraph>

          <XStack
            flexWrap="wrap"
            gap={media.md ? '$3' : '$5'}
            justifyContent="center"
            width="100%"
            marginTop="$4"
          >
            {socialNetworks.map((social) => {
              const content = (
                <YStack
                  key={social.name}
                  alignItems="center"
                  gap="$1.5"
                  $md={{ flexBasis: '48%', alignItems: 'center' }}
                  hoverStyle={{
                    scale: 1.05,
                    y: -4,
                  }}
                >
                  <Image
                    source={{ uri: social.image }}
                    width={media.md ? 110 : 165}
                    height={media.md ? 110 : 165}
                    resizeMode="contain"
                    alt={social.name}
                  />
                </YStack>
              )

              return social.href ? (
                <Anchor
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  textDecorationLine="none"
                >
                  {content}
                </Anchor>
              ) : (
                content
              )
            })}
          </XStack>
        </YStack>
      </Container>
    </YStack>
  )
}
