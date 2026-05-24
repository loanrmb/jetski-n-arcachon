'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/reservations/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { formatDate, formatTime } from '@/lib/utils'
import { DURATION_LABELS, SOURCE_LABELS, type Reservation, type JetSki, type Client, type ReservationStatus } from '@/types'
import { Eye, Download, CheckSquare, X, Star } from 'lucide-react'

type Row = Reservation & { jet_ski: JetSki; client: Client }

interface Props {
  reservations:    Row[]
  repeatClientIds: Set<string>
}

// ── CSV generation (no external dependency) ────────────────
function escapeCSV(v: unknown): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function buildCSV(rows: Row[]): string {
  const HEADERS = [
    'id', 'client_nom', 'email', 'téléphone', 'modèle', 'date', 'créneau',
    'durée_h', 'personnes', 'statut', 'source', 'caution', 'note_interne', 'créé_le',
  ]
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    lines.push([
      r.id,
      `${r.client?.first_name ?? ''} ${r.client?.last_name ?? ''}`.trim(),
      r.client?.email ?? '',
      r.client?.phone ?? '',
      r.jet_ski?.name ?? '',
      r.date,
      formatTime(r.slot_time),
      r.duration_hours,
      r.nb_persons,
      r.status,
      r.source,
      r.caution_collected ? 'oui' : 'non',
      r.internal_note ?? '',
      r.created_at,
    ].map(escapeCSV).join(','))
  }
  return lines.join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReservationsClient({ reservations, repeatClientIds }: Props) {
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef   = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const allIds     = reservations.map(r => r.id)
  const allSelected = selected.size > 0 && allIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }
  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function bulkStatus(newStatus: ReservationStatus) {
    if (selected.size === 0) return
    setBulkLoading(true)
    const ids = Array.from(selected)
    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in('id', ids)

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      toast({
        title: `${ids.length} réservation${ids.length > 1 ? 's' : ''} ${newStatus === 'confirmed' ? 'confirmée' : 'annulée'}${ids.length > 1 ? 's' : ''}`,
        variant: newStatus === 'confirmed' ? 'success' : 'default',
      })
      setSelected(new Set())
      // Refresh page data via native navigation (server component will re-fetch)
      window.location.reload()
    }
    setBulkLoading(false)
  }

  async function handleExport() {
    const from = fromRef.current?.value
    const to   = toRef.current?.value
    if (!from || !to) {
      toast({ title: 'Sélectionnez une période', variant: 'destructive' })
      return
    }
    setExportLoading(true)
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, jet_ski:jet_skis(*), client:clients(*)')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .order('slot_time')

      if (error) throw error
      const rows = (data ?? []) as Row[]
      const csv  = buildCSV(rows)
      downloadCSV(csv, `reservations_${from}_${to}.csv`)
      setExportOpen(false)
      toast({ title: `${rows.length} réservations exportées`, variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Erreur export', description: err.message, variant: 'destructive' })
    }
    setExportLoading(false)
  }

  return (
    <>
      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Exporter CSV
        </Button>
      </div>

      {/* Tableau */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Créneau</TableHead>
              <TableHead>Jet ski</TableHead>
              <TableHead>Durée</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  Aucune réservation trouvée.
                </TableCell>
              </TableRow>
            ) : (
              reservations.map(r => (
                <TableRow
                  key={r.id}
                  className={[
                    'transition-colors duration-100 hover:bg-slate-50/80',
                    selected.has(r.id) ? 'bg-blue-50/60' : '',
                  ].join(' ')}
                >
                  <TableCell className="px-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      {repeatClientIds.has(r.client_id) && (
                        <Star
                          className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0"
                          aria-label="Client fidèle"
                        />
                      )}
                      {r.client?.first_name} {r.client?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.client?.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                  <TableCell className="text-sm">{formatTime(r.slot_time)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      {r.jet_ski && (
                        <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ backgroundColor: r.jet_ski.color }} />
                      )}
                      {r.jet_ski?.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{DURATION_LABELS[r.duration_hours]}</TableCell>
                  <TableCell className="text-sm">{SOURCE_LABELS[r.source]}</TableCell>
                  <TableCell className="text-sm font-medium">{r.price_total ? `${r.price_total} €` : '—'}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/reservations/${r.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Floating bulk action bar ── */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white rounded-xl px-5 py-3 shadow-2xl">
          <span className="text-sm font-medium">
            <CheckSquare className="h-4 w-4 inline mr-1.5 opacity-70" />
            {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            variant="accent"
            disabled={bulkLoading}
            onClick={() => bulkStatus('confirmed')}
          >
            Confirmer ({selected.size})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkLoading}
            className="border-red-400 text-red-400 hover:bg-red-900/20"
            onClick={() => bulkStatus('cancelled')}
          >
            Annuler ({selected.size})
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-1 text-slate-400 hover:text-white transition-colors"
            aria-label="Désélectionner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── CSV Export dialog ── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exporter les réservations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="csv_from">Date de début</Label>
              <Input id="csv_from" type="date" ref={fromRef} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="csv_to">Date de fin</Label>
              <Input id="csv_to" type="date" ref={toRef} />
            </div>
            <p className="text-xs text-muted-foreground">
              Colonnes : id, client, email, téléphone, modèle, date, créneau, durée, personnes, statut, source, caution, note, créé le
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setExportOpen(false)}>Annuler</Button>
            <Button variant="accent" onClick={handleExport} disabled={exportLoading}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {exportLoading ? 'Génération…' : 'Télécharger'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
