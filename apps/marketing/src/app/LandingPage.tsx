'use client'

import { YStack } from 'tamagui'
import Header from '../sections/Header'
import Hero from '../sections/Hero'
import Vision from '../sections/Vision'
import Principles from '../sections/Principles'
import Features from '../sections/Features'
import Applications from '../sections/Applications'
import Whitepaper from '../sections/Whitepaper'
import GettingStarted from '../sections/GettingStarted'
import Contact from '../sections/CTA'
import Footer from '../sections/Footer'
import type { Language } from '../providers/i18n'

interface LandingPageProps {
  onLanguageChange?: (language: Language) => Promise<void> | void
}

export default function LandingPage({ onLanguageChange }: LandingPageProps = {}) {
  return (
    <YStack backgroundColor="$background" minHeight="100vh">
      <Header />
      <Hero />
      <Vision />
      <Principles />
      <Features />
      <Applications />
      <Whitepaper />
      <GettingStarted />
      <Contact />
      <Footer />
    </YStack>
  )
}
