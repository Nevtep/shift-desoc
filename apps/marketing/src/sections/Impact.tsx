'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card, Text } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Impact() {
  const t = useTranslations()

  const impactSections = [
    {
      title: t.impactIndividualsTitle,
      items: [
        t.impactIndividuals1,
        t.impactIndividuals2,
        t.impactIndividuals3,
        t.impactIndividuals4,
      ],
    },
    {
      title: t.impactCommunitiesTitle,
      items: [
        t.impactCommunities1,
        t.impactCommunities2,
        t.impactCommunities3,
        t.impactCommunities4,
      ],
    },
    {
      title: t.impactSocietyTitle,
      items: [
        t.impactSociety1,
        t.impactSociety2,
        t.impactSociety3,
        t.impactSociety4,
      ],
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
            {t.impactTitle}
          </Heading>
          
          <XStack
            flexWrap="wrap"
            gap="$4"
            justifyContent="center"
          >
            {impactSections.map((section, index) => (
              <Card
                key={index}
                flex={1}
                minWidth={300}
                maxWidth={380}
                backgroundColor="$white"
                padding="$5"
                borderRadius="$3"
                elevation="$1"
              >
                <YStack gap="$4">
                  <Heading fontSize="$5" fontWeight="600" color="$textDark">
                    {section.title}
                  </Heading>
                  
                  <YStack gap="$3">
                    {section.items.map((item, itemIndex) => (
                      <Paragraph
                        key={itemIndex}
                        fontSize="$2"
                        color="$textMedium"
                        lineHeight="$4"
                      >
                        ✅ <Text fontWeight="600" display="inline">{item}</Text>
                      </Paragraph>
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
