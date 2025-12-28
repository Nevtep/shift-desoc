'use client'

import React from 'react'
import { YStack, XStack, Heading, Paragraph, Card, useMedia } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'

export default function Applications() {
  const t = useTranslations()
  const media = useMedia()
  const { ref: headingRef, visible: headingVisible } = useRevealOnScroll<HTMLDivElement>()
  const { ref: listRef, visible: listVisible } = useRevealOnScroll<HTMLDivElement>()

  const useCases = [
    {
      title: t.application1Title,
      coordination: t.application1Coordination,
      withShift: t.application1WithShift,
      example: t.application1Example,
    },
    {
      title: t.application2Title,
      coordination: t.application2Coordination,
      withShift: t.application2WithShift,
      example: t.application2Example,
    },
    {
      title: t.application3Title,
      coordination: t.application3Coordination,
      withShift: t.application3WithShift,
      example: t.application3Example,
    },
    {
      title: t.application4Title,
      coordination: t.application4Coordination,
      withShift: t.application4WithShift,
      example: t.application4Example,
    },
    {
      title: t.application5Title,
      coordination: t.application5Coordination,
      withShift: t.application5WithShift,
      example: t.application5Example,
    },
    {
      title: t.application6Title,
      coordination: t.application6Coordination,
      withShift: t.application6WithShift,
      example: t.application6Example,
    },
    {
      title: t.application7Title,
      coordination: t.application7Coordination,
      withShift: t.application7WithShift,
      example: t.application7Example,
    },
    {
      title: t.application8Title,
      coordination: t.application8Coordination,
      withShift: t.application8WithShift,
      example: t.application8Example,
    },
    {
      title: t.application9Title,
      coordination: t.application9Coordination,
      withShift: t.application9WithShift,
      example: t.application9Example,
    },
    {
      title: t.application10Title,
      coordination: t.application10Coordination,
      withShift: t.application10WithShift,
      example: t.application10Example,
    },
  ]

  const renderCard = (useCase: (typeof useCases)[number], index: number, isMobile: boolean) => (
    <Card
      key={useCase.title}
      flex={1}
      maxWidth={isMobile ? '100%' : 520}
      minWidth={isMobile ? '100%' : 320}
      backgroundColor="rgba(246, 240, 225, 0.92)"
      padding="$6"
      borderRadius="$4"
      elevation="$2"
      borderWidth={1}
      borderColor="rgba(86, 102, 69, 0.15)"
      hoverStyle={{
        elevation: '$3',
        scale: 1.02,
        y: -3,
      }}
    >
      <YStack gap="$3" position="relative">
        {/* En móvil no mostramos badge numérico para dejar el título limpio */}
        <Heading fontSize="$6" fontWeight="700" color="$secondary" lineHeight={28}>
          {useCase.title}
        </Heading>

        <Paragraph fontSize="$3" color="$primaryDark" lineHeight="$4" fontWeight="600">
          {useCase.coordination}
        </Paragraph>

        <Paragraph fontSize="$3" color="$primaryDark" lineHeight="$4" fontWeight="600">
          {useCase.withShift}
        </Paragraph>

        <Paragraph fontSize="$3" color="$textMedium" lineHeight="$4">
          {useCase.example}
        </Paragraph>
      </YStack>
    </Card>
  )

  return (
    <YStack
      id="applications"
      paddingTop={80}
      paddingBottom={80}
      paddingHorizontal={0}
      width="100%"
       position="relative"
      style={{
        backgroundImage: 'url(/uses-bg.webp)',
        backgroundSize: 'cover',
        backgroundPosition: media.md ? 'left' : 'center',
        backgroundRepeat: 'repeat-y',
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
          minHeight={720}
          justifyContent="center"
          paddingTop={12}
          paddingBottom={12}
          ref={listRef}
        >
          <YStack gap="$3" alignItems="center" position="relative" zIndex={1} paddingVertical={20}>
            <Heading
              fontSize="$11"
              fontWeight="700"
              color="$primary"
              textAlign="center"
              lineHeight={50}
              className={`reveal reveal-up ${headingVisible ? 'is-visible' : ''}`}
              ref={headingRef}
            >
              {t.applicationsTitle}
            </Heading>
            <Paragraph
              fontSize="$7"
              fontWeight="600"
              color="$secondary"
              textAlign="center"
              maxWidth={900}
              marginBottom={20}
              className={`reveal reveal-up reveal-delay-1 ${headingVisible ? 'is-visible' : ''}`}
            >
              {t.applicationsSubtitle}
            </Paragraph>
          </YStack>

          <YStack position="relative" width="100%" gap="$6" paddingBottom={20} zIndex={1}>
            {media.md ? (
              <YStack gap="$4">
                {useCases.map((useCase, index) => (
                  <YStack
                    key={useCase.title}
                    className={`reveal reveal-up ${listVisible ? 'is-visible' : ''} ${
                      index % 3 === 1 ? 'reveal-delay-1' : index % 3 === 2 ? 'reveal-delay-2' : ''
                    }`}
                  >
                    {renderCard(useCase, index, true)}
                  </YStack>
                ))}
              </YStack>
            ) : (
              <>
                <YStack
                  position="absolute"
                  top={0}
                  bottom={0}
                  left="50%"
                  marginLeft={-1}
                  width={2}
                  backgroundColor="rgba(86, 102, 69, 0.25)"
                  pointerEvents="none"
                />

                {useCases.map((useCase, index) => {
                  const isLeft = index % 2 === 0
                  return (
                    <XStack
                      key={useCase.title}
                      width="100%"
                      alignItems="center"
                      position="relative"
                      gap="$3"
                      paddingVertical="$2"
                      className={`reveal reveal-up ${listVisible ? 'is-visible' : ''} ${
                        index % 3 === 1 ? 'reveal-delay-1' : index % 3 === 2 ? 'reveal-delay-2' : ''
                      }`}
                    >
                      <YStack flex={1} alignItems="flex-end" justifyContent="center" paddingRight="$3">
                        {isLeft ? renderCard(useCase, index, false) : null}
                      </YStack>

                      <YStack width={60} alignItems="center" justifyContent="center" flexShrink={0} zIndex={2}>
                        <YStack
                          width={34}
                          height={34}
                          borderRadius={20}
                          backgroundColor="$primary"
                          alignItems="center"
                          justifyContent="center"
                          elevation="$2"
                          borderWidth={2}
                          borderColor="rgba(246, 240, 225, 0.95)"
                        >
                          <Heading fontSize="$4" color="#ede3cf" fontWeight="700">
                            {(index + 1).toString().padStart(2, '0')}
                          </Heading>
                        </YStack>
                      </YStack>

                      <YStack flex={1} alignItems="flex-start" justifyContent="center" paddingLeft="$3">
                        {!isLeft ? renderCard(useCase, index, false) : null}
                      </YStack>
                    </XStack>
                  )
                })}
              </>
            )}
          </YStack>
        </YStack>
      </Container>
    </YStack>
  )
}
