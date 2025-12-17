'use server'

import { cookies } from 'next/headers'
import type { Language } from '../lib/i18n'

const COOKIE_NAME = 'shift-language'
const ONE_YEAR = 60 * 60 * 24 * 365

export async function setLanguageAction(language: Language) {
  if (language !== 'en' && language !== 'es') {
    throw new Error('Unsupported language')
  }

  const cookieStore = await cookies()
  cookieStore.set({
    name: COOKIE_NAME,
    value: language,
    path: '/',
    maxAge: ONE_YEAR,
  })

  return language
}
