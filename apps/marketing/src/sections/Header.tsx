'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Paragraph, XStack, YStack, Anchor, Button, useMedia, Stack, ScrollView } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'
import LanguageSelector from './LanguageSelector'
import { secondaryGradientButton } from '../components/buttonStyles'
import { Menu, X as Close } from 'lucide-react'

const DEFAULT_HEADER_HEIGHT = 120

export default function Header() {
  const t = useTranslations()
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('#home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT)
  const headerRef = useRef<HTMLElement | null>(null)
  const media = useMedia()

  const navItems = useMemo(
    () => [
      { href: '#home', label: t.navHome },
      { href: '#about', label: t.navAbout },
      { href: '#principles', label: t.navPrinciples },
      { href: '#solutions', label: t.navSolutions },
      { href: '#applications', label: t.navApplications },
      { href: '#whitepaper', label: t.navWhitepaper },
      { href: '#contact', label: t.navContact },
    ],
    [t.navAbout, t.navApplications, t.navContact, t.navHome, t.navPrinciples, t.navSolutions, t.navWhitepaper]
  )

  const scrollToSection = (href: string) => {
    const id = href.slice(1)
    const target = document.getElementById(id)

    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight
      window.scrollTo({ top, behavior: 'smooth' })
      window.history.replaceState(null, '', href)
      setActiveSection(href)
      setMenuOpen(false)
    }
  }

  const handleNavClick = (href: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    scrollToSection(href)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const measureHeader = () => {
      const measured = headerRef.current?.getBoundingClientRect().height
      if (measured) setHeaderHeight(Math.max(0, Math.round(measured)))
    }

    measureHeader()
    window.addEventListener('resize', measureHeader)

    const HEADER_OFFSET = headerHeight + 20
    const onScroll = () => {
      setScrolled(window.scrollY > 8)

      let current = '#home'
      navItems.forEach((item) => {
        const id = item.href.slice(1)
        const section = document.getElementById(id)
        if (!section) return

        if (window.scrollY + HEADER_OFFSET >= section.offsetTop) {
          current = item.href
        }
      })
      setActiveSection(current)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measureHeader)
    }
  }, [navItems, headerHeight])

  return (
    <header
      ref={headerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        backgroundColor: '#f6f0e1',
      }}
    >
      <YStack
        backgroundColor="#f6f0e1"
        paddingVertical="$2"
        style={{
          boxShadow: scrolled ? '0 4px 10px rgba(0,0,0,0.05)' : 'none',
          transition: 'box-shadow 180ms ease',
        }}
        $md={{ paddingVertical: '$1' }}
      >
        <Container maxWidth={1250} width="100%">
          <XStack alignItems="center" justifyContent="space-between" gap="$6">
            <Link href="#home" aria-label="Shift home" style={{ textDecoration: 'none' }}>
              <Image
                src="/imagotipo-h.svg"
                alt="Shift Logo"
                width={352}
                height={125}
                priority
                style={{
                  objectFit: 'contain',
                  width: 'auto',
                  height: 'auto',
                  maxHeight: media.md ? '95px' : '115px',
                  maxWidth: media.md ? '332px' : '352px',
                }}
              />
            </Link>

            <XStack gap="$3" alignItems="center" flex={1} justifyContent="flex-end">
              <XStack gap="$5" alignItems="center" $md={{ display: 'none' }}>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    onClick={(event) => handleNavClick(item.href, event)}
                    style={{ textDecoration: 'none' }}
                  >
                    {/* sin subrayado; solo marca la sección activa */}
                    <Paragraph
                      fontSize={18}
                      color="#6C8158"
                      fontWeight="700"
                      borderBottomColor={activeSection === item.href ? '#DD8848' : 'transparent'}
                      borderBottomWidth={activeSection === item.href ? 2 : 0}
                      paddingBottom={5}
                      textDecorationLine="none"
                    >
                      {item.label}
                    </Paragraph>
                  </Link>
                ))}

                <LanguageSelector />
              </XStack>

              <XStack gap="$2" alignItems="center" $md={{ display: 'none' }}>
                <Anchor
                  href="#getting-started"
                  {...secondaryGradientButton}
                  paddingHorizontal="$4"
                  fontSize="$5"
                >
                  {t.navGetStarted}
                </Anchor>
              </XStack>

              <Button
                size="$5"
                aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
                onPress={() => setMenuOpen((prev) => !prev)}
                backgroundColor="transparent"
                borderWidth={0}
                paddingHorizontal="$2"
                paddingVertical="$2"
                minWidth={44}
                display="none"
                marginRight="$5"
                $md={{ display: 'flex' }}
              >
                {menuOpen ? <Close size={22} color="#6C8158" /> : <Menu size={22} color="#6C8158" />}
              </Button>
            </XStack>
          </XStack>
        </Container>
      </YStack>

      {menuOpen && (
        <>
          <Stack
            position="fixed"
            inset={0}
            backgroundColor="rgba(0,0,0,0.25)"
            zIndex={1000}
            display="none"
            $md={{ display: 'flex' }}
            onPress={() => setMenuOpen(false)}
          />
          <YStack
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            backgroundColor="#f6f0e1"
            padding="$6"
            gap="$4"
            zIndex={1100}
            style={{ boxShadow: '0 12px 28px rgba(0,0,0,0.16)' }}
            display="none"
            $md={{ display: 'flex' }}
          >
            <XStack justifyContent="space-between" alignItems="center">
              <Paragraph fontSize={20} fontWeight="800" color="#6C8158">
                {t.navHome}
              </Paragraph>
              <Button
                size="$4"
                aria-label="Cerrar menú"
                onPress={() => setMenuOpen(false)}
                backgroundColor="transparent"
                borderWidth={0}
                padding="$2"
                minWidth={44}
              >
                <Close size={20} color="#6C8158" />
              </Button>
            </XStack>

            <ScrollView showsVerticalScrollIndicator={false}>
              <YStack gap="$3" marginTop="$3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    onClick={(event) => handleNavClick(item.href, event)}
                    style={{ textDecoration: 'none' }}
                  >
                    <Paragraph
                      fontSize={18}
                      color="#6C8158"
                      fontWeight="700"
                      borderBottomColor={activeSection === item.href ? '#DD8848' : 'transparent'}
                      borderBottomWidth={activeSection === item.href ? 2 : 0}
                      paddingBottom={8}
                      $md={{ paddingBottom: 4 }}
                    >
                      {item.label}
                    </Paragraph>
                  </Link>
                ))}
              </YStack>

              <YStack gap="$3" marginTop="$4">
                <Anchor
                  href="#getting-started"
                  {...secondaryGradientButton}
                  paddingHorizontal="$4"
                  fontSize="$5"
                  onPress={(event) => {
                    // previene navegación default y hace scroll manual
                    // @ts-expect-error: onPress event puede no exponer preventDefault en web
                    event?.preventDefault?.()
                    scrollToSection('#getting-started')
                  }}
                >
                  {t.navGetStarted}
                </Anchor>
                <LanguageSelector variant="inline" />
              </YStack>
            </ScrollView>
          </YStack>
        </>
      )}
    </header>
  )
}
