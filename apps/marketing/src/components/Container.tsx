'use client'

import React from 'react'
import { YStack } from 'tamagui'
import type { StackProps } from 'tamagui'

export type ContainerProps = StackProps & {
  children?: React.ReactNode
}

export function Container({
  children,
  maxWidth = 1200,
  width = '100%',
  alignSelf = 'center',
  ...rest
}: ContainerProps) {
  return (
    <YStack maxWidth={maxWidth} width={width} alignSelf={alignSelf} {...rest}>
      {children}
    </YStack>
  )
}
