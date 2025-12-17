import 'server-only'

import { cookies } from 'next/headers'
import type { Language } from './index'

const LANGUAGE_COOKIE = 'shift-language'
const DEFAULT_LANGUAGE: Language = 'es'

export async function getLanguage(): Promise<Language> {
  const cookieStore = await cookies()
  const lang = cookieStore.get(LANGUAGE_COOKIE)?.value
  return lang === 'en' || lang === 'es' ? lang : DEFAULT_LANGUAGE
}
