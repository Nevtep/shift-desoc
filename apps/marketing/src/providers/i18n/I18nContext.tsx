'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import { translations, type Language } from './index'

type Translations = typeof translations.en

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children, initialLanguage = 'es' }: { children: React.ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  const value = useMemo<I18nContextType>(() => ({
    language,
    setLanguage: setLanguageState,
    t: translations[language],
  }), [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslations(): Translations {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslations must be used within I18nProvider')
  }
  return context.t
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useLanguage must be used within I18nProvider')
  }
  return [context.language, context.setLanguage]
}
