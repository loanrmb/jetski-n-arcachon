'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts
        .filter(t => t.open !== false)
        .map(toast => (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 shadow-lg bg-card text-card-foreground',
              toast.variant === 'destructive' && 'border-red-200 bg-red-50 text-red-900',
              toast.variant === 'success' && 'border-green-200 bg-green-50 text-green-900'
            )}
          >
            <div className="flex-1 min-w-0">
              {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
              {toast.description && <p className="text-sm opacity-80">{toast.description}</p>}
            </div>
            <button onClick={() => dismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
    </div>
  )
}
