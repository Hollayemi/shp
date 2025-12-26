"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { usePathname } from "next/navigation"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname()
  const isLightModeOnly = pathname?.startsWith('/embed') || pathname?.startsWith('/demo')

  React.useEffect(() => {
    if (isLightModeOnly) {
      const htmlElement = document.documentElement
      htmlElement.classList.remove('dark')
      htmlElement.classList.add('light')

      htmlElement.style.colorScheme = 'light'
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (htmlElement.classList.contains('dark')) {
              htmlElement.classList.remove('dark')
              htmlElement.classList.add('light')
            }
          }
        })
      })
      
      observer.observe(htmlElement, {
        attributes: true,
        attributeFilter: ['class']
      })
      
      return () => observer.disconnect()
    }
  }, [isLightModeOnly])

  // For embedded mode, force light theme and disable theme switching
  const themeProps = isLightModeOnly 
    ? {
        ...props,
        forcedTheme: 'light',
        enableSystem: false,
        attribute: undefined,
      }
    : props

  return <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
}