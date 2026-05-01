"use client";

import { Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  getAvailableLocales,
  getClientLocale,
  getI18n,
  getLocaleBadge,
  getLocaleLabel,
  setLocaleCookie,
  type AppLocale
} from "../../lib/i18n";

export function LanguageSelector() {
  const t = getI18n().layout;
  const [isOpen, setIsOpen] = useState(false);
  const [locale, setLocale] = useState<AppLocale>(getClientLocale());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const locales = getAvailableLocales();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleLocaleChange(nextLocale: AppLocale) {
    if (nextLocale === locale) {
      setIsOpen(false);
      return;
    }
    setLocale(nextLocale);
    setLocaleCookie(nextLocale);
    setIsOpen(false);
    window.location.reload();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t.languageMenuAria}
      >
        <Globe2 className="h-4 w-4" aria-hidden />
        <span>{getLocaleBadge(locale)}</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[140px] rounded-lg border border-border bg-background p-1 shadow-lg">
          {locales.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleLocaleChange(item)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                locale === item ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted text-foreground"
              }`}
            >
              <span>{getLocaleLabel(item)}</span>
              <span className="text-xs">{getLocaleBadge(item)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
