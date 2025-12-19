'use client'

import React from 'react'
import { XStack } from 'tamagui'
import Image from 'next/image'

export default function Header() {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        backgroundColor: 'transparent',
      }}
    >
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        backgroundColor="$background"
        borderBottomWidth={1}
        borderBottomColor="$greyLight"
        alignItems="center"
        justifyContent="flex-start"
      >
        <Image
          src="/imagotipo-h.svg"
          alt="Shift Logo"
          width={200}
          height={100}
          priority
          style={{
            objectFit: 'contain',
            height: 'auto',
            maxHeight: '60px',
          }}
        />
      </XStack>
    </header>
  )
}
