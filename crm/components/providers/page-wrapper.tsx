'use client'

import { usePathname } from 'next/navigation'

/**
 * Wraps each CRM page with a fade + slide-up entrance animation.
 * The `key={pathname}` forces a remount on every route change,
 * which re-triggers the CSS animation classes.
 */
export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className="flex flex-col min-h-full animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out"
    >
      {children}
    </div>
  )
}
