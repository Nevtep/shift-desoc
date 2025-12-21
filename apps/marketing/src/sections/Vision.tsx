'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card, Text, useMedia } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'

const CheckCircleIcon = ({ color = '#6C8158' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill={color} />
    <path
      d="M17 9.5L11 15.5L8 12.5"
      stroke="#FFFFFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default function Vision() {
  const t = useTranslations()
  const media = useMedia()

  return (
    <YStack
      id="about"
      backgroundColor="$background"
      paddingVertical={0}
      paddingHorizontal={0}
      width="100%"
      position="relative"
      overflow="hidden"
      style={{
        backgroundImage: 'url("/nosotros_bg.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        height="30%"
        pointerEvents="none"
        backgroundImage="linear-gradient(180deg, rgba(246, 240, 225, 0.9) 0%, rgba(246, 240, 225, 0) 100%)"
      />
      <Container maxWidth={1250} width="100%" paddingHorizontal={0}>
        <YStack
          width="100%"
          padding="$6"
          position="relative"
          overflow="hidden"
          $md={{ paddingHorizontal: 10, paddingVertical: '$4' }}
        >
          <YStack
            gap="$5"
            alignItems="center"
            padding={60}
            position="relative"
            zIndex={1}
            $md={{ padding: 24, gap: '$4' }}
          >
            <Heading
              fontSize="$11"
              fontWeight="700"
              color="$primary"
              textAlign="center"
            >
              Visión
            </Heading>
            <Paragraph
              fontSize="$8"
              fontWeight="700"
              color="$secondary"
              textAlign="center"
              $md={{ fontSize: 22, lineHeight: 28 }}
            >
              {t.visionSubtitle}
            </Paragraph>
            
            <YStack
              width="100%"
              style={{
                display: 'grid',
                gridTemplateColumns: media.md ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: media.md ? 16 : 24,
                alignItems: 'stretch',
              }}
            >
              <Card
                flex={1}
                alignSelf="stretch"
                backgroundColor="rgba(246, 240, 225, 0.8)"
                padding="$6"
                borderRadius="$3"
                height="100%"
                display="flex"
                flexDirection="column"
                elevation={0}
                hoverStyle={{
                  scale: 1.01,
                }}
              >
                <YStack gap="$5" paddingHorizontal={20} flex={1} $md={{ paddingHorizontal: 12, gap: '$4' }}>
                  <YStack
                    padding="$2"
                    borderRadius="$2"
                    alignItems="center"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #c4733c 0%, #DD8848 100%)',
                    }}
                  >
                    <Heading fontSize="$7" fontWeight="700" color="$white">
                      {t.problemTitle}
                    </Heading>
                  </YStack>
                  <YStack
                    tag="ul"
                    gap="$3"
                    paddingLeft={0}
                    style={{ listStyleType: 'none' }}
                    marginTop="$2"
                    $md={{ gap: '$2' }}
                  >
                    {[t.problem1, t.problem2, t.problem3, t.problem4].map((textItem, index) => {
                      const words = textItem.split(' ')
                      const boldPart = words.slice(0, 2).join(' ')
                      const restPart = words.slice(2).join(' ')
                      return (
                        <XStack key={index} tag="li" alignItems="flex-start" gap="$3">
                          <YStack width={26} height={26} alignItems="center" justifyContent="center" flexShrink={0}>
                            <CheckCircleIcon color="#DD8848" />
                          </YStack>
                          <Paragraph
                            color="$primary"
                            lineHeight={24}
                            flex={1}
                            fontSize="$5"
                            $md={{ fontSize: 16, lineHeight: 22 }}
                          >
                            <Text fontWeight="700" color="$primary">
                              {boldPart}
                            </Text>
                            {restPart ? ' ' + restPart : ''}
                          </Paragraph>
                        </XStack>
                      )
                    })}
                  </YStack>
                </YStack>
              </Card>
              
              <Card
                flex={1}
                alignSelf="stretch"
                backgroundColor="rgba(246, 240, 225, 0.8)"
                padding="$6"
                borderRadius="$3"
                height="100%"
                display="flex"
                flexDirection="column"
                elevation={0}
                hoverStyle={{
                  scale: 1.01,
                }}
              >
                <YStack gap="$5" paddingHorizontal={20} flex={1} $md={{ paddingHorizontal: 12, gap: '$4' }}>
                  <YStack
                    padding="$2"
                    borderRadius="$2"
                    alignItems="center"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #566645 0%, #6C8158 100%)',
                    }}
                  >
                    <Heading fontSize="$7" fontWeight="700" color="$white">
                      {t.solutionTitle}
                    </Heading>
                  </YStack>
                  <YStack
                    tag="ul"
                    gap="$3"
                    paddingLeft={0}
                    style={{ listStyleType: 'none' }}
                    marginTop="$2"
                    $md={{ gap: '$2' }}
                  >
                    {[t.solution1, t.solution2, t.solution3, t.solution4].map((textItem, index) => {
                      const words = textItem.split(' ')
                      const boldPart = words.slice(0, 2).join(' ')
                      const restPart = words.slice(2).join(' ')
                      return (
                        <XStack key={index} tag="li" alignItems="flex-start" gap="$3">
                          <YStack width={26} height={26} alignItems="center" justifyContent="center" flexShrink={0}>
                            <CheckCircleIcon />
                          </YStack>
                          <Paragraph
                            color="$primary"
                            lineHeight={24}
                            flex={1}
                            fontSize="$5"
                            $md={{ fontSize: 16, lineHeight: 22 }}
                          >
                            <Text fontWeight="700" color="$primary">
                              {boldPart}
                            </Text>
                            {restPart ? ' ' + restPart : ''}
                          </Paragraph>
                        </XStack>
                      )
                    })}
                  </YStack>
                </YStack>
              </Card>
            </YStack>
          </YStack>
        </YStack>
      </Container>
    </YStack>
  )
}
