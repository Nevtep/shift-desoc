'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Paragraph, XStack, YStack, Anchor } from 'tamagui'
import { Container } from '../components/Container'
import { useTranslations } from '../providers/i18n/I18nContext'
import LanguageSelector from './LanguageSelector'
import { secondaryGradientButton } from '../components/buttonStyles'

const HEADER_HEIGHT = 120

export default function Header() {
  const t = useTranslations()
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('#home')

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

  const handleNavClick = (href: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const id = href.slice(1)
    const target = document.getElementById(id)

    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT
      window.scrollTo({ top, behavior: 'smooth' })
      window.history.replaceState(null, '', href)
      setActiveSection(href)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const HEADER_OFFSET = 140
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
    return () => window.removeEventListener('scroll', onScroll)
  }, [navItems])

  return (
    <header
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
                  maxHeight: '115px',
                  maxWidth: '352px',
                }}
              />
            </Link>

            <XStack gap="$5" alignItems="center" flex={1} justifyContent="flex-end">
              <XStack gap="$5" alignItems="center">
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

              <XStack gap="$2" alignItems="center">
                <Anchor
                  href="#contact"
                  {...secondaryGradientButton}
                  paddingHorizontal="$4"
                  fontSize="$5"
                >
                  {t.navGetStarted}
                </Anchor>
              </XStack>
            </XStack>
          </XStack>
        </Container>
      </YStack>
    </header>
  )
}
