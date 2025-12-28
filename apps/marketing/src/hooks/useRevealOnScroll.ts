import { useEffect, useRef, useState } from 'react'

/**
 * Hook ligero para revelar elementos al entrar en viewport.
 * Devuelve el ref a observar y un flag visible para togglear clases.
 */
export function useRevealOnScroll<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const elementRef = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const target = elementRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.15,
        ...options,
      }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [options])

  return { ref: elementRef, visible }
}


