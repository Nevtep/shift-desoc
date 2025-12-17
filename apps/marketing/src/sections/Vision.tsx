'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

export default function Vision() {
  const t = useTranslations()

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
            color="$color"
            textAlign="center"
          >
            {t.visionTitle}
          </Heading>
          
          <XStack
            flexWrap="wrap"
            gap="$6"
            justifyContent="center"
          >
            <Card
              flex={1}
              minWidth={450}
              maxWidth={600}
              backgroundColor="$white"
              padding="$6"
              borderRadius="$3"
              elevation="$1"
              hoverStyle={{
                elevation: '$2',
                scale: 1.02,
              }}
            >
              <YStack gap="$4">
                <Heading fontSize="$6" fontWeight="600" color="$color">
                  {t.problemTitle}
                </Heading>
                <YStack gap="$2">
                  <Paragraph color="$colorHover">• {t.problem1}</Paragraph>
                  <Paragraph color="$colorHover">• {t.problem2}</Paragraph>
                  <Paragraph color="$colorHover">• {t.problem3}</Paragraph>
                  <Paragraph color="$colorHover">• {t.problem4}</Paragraph>
                </YStack>
              </YStack>
            </Card>
            
            <Card
              flex={1}
              minWidth={450}
              maxWidth={600}
              backgroundColor="$white"
              padding="$6"
              borderRadius="$3"
              elevation="$1"
              hoverStyle={{
                elevation: '$2',
                scale: 1.02,
              }}
            >
              <YStack gap="$4">
                <Heading fontSize="$6" fontWeight="600" color="$color">
                  {t.solutionTitle}
                </Heading>
                <YStack gap="$2">
                  <Paragraph color="$colorHover" fontWeight="600">
                    {t.solution1}
                  </Paragraph>
                  <Paragraph color="$colorHover" fontWeight="600">
                    {t.solution2}
                  </Paragraph>
                  <Paragraph color="$colorHover" fontWeight="600">
                    {t.solution3}
                  </Paragraph>
                  <Paragraph color="$colorHover" fontWeight="600">
                    {t.solution4}
                  </Paragraph>
                </YStack>
              </YStack>
            </Card>
          </XStack>
        </YStack>
      </Container>
    </YStack>
  )
}
