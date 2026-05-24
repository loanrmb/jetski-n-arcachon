'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, Zap, Gauge, Users, BanIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { JETSKI_STATUS_LABELS, type JetSki, type JetSkiStatus } from '@/types'
import { JetSkiForm } from './jet-ski-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'

const statusVariant: Record<JetSkiStatus, 'default' | 'secondary' | 'destructive'> = {
  active:         'default',
  maintenance:    'secondary',
  out_of_service: 'destructive',
}

/** Inline toggle — no extra dependency */
function BookingToggle({
  enabled,
  disabled: busy,
  onChange,
}: {
  enabled: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={busy}
      onClick={() => onChange(!enabled)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200',
        enabled ? 'bg-blue-500' : 'bg-slate-300',
        busy   ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
          enabled ? 'translate-x-[18px]' : 'translate-x-[3px]',
        ].join(' ')}
      />
    </button>
  )
}

interface Props {
  initialJetSkis: JetSki[]
}

export function FleetClient({ initialJetSkis }: Props) {
  const [jetSkis, setJetSkis]           = useState<JetSki[]>(initialJetSkis)
  const [editTarget, setEditTarget]     = useState<JetSki | null>(null)
  const [createOpen, setCreateOpen]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<JetSki | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [togglingId, setTogglingId]     = useState<string | null>(null)
  const supabase = createClient()

  function handleSaved(saved: JetSki) {
    setJetSkis(prev => {
      const idx = prev.findIndex(j => j.id === saved.id)
      if (idx >= 0) return prev.map(j => j.id === saved.id ? saved : j)
      return [...prev, saved]
    })
    setEditTarget(null)
    setCreateOpen(false)
  }

  async function handleBookingToggle(js: JetSki, newValue: boolean) {
    setTogglingId(js.id)
    const { error } = await supabase
      .from('jet_skis')
      .update({ booking_enabled: newValue })
      .eq('id', js.id)

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      setJetSkis(prev => prev.map(j => j.id === js.id ? { ...j, booking_enabled: newValue } : j))
      toast({
        title: newValue
          ? `${js.name} — réservations réactivées`
          : `${js.name} — réservations bloquées`,
        variant: newValue ? 'success' : 'default',
      })
    }
    setTogglingId(null)
  }

  async function handleDelete(js: JetSki) {
    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('jet_ski_id', js.id)
      .in('status', ['pending', 'confirmed', 'in_progress'])

    if ((count ?? 0) > 0) {
      toast({
        title: 'Suppression impossible',
        description: 'Ce modèle a des réservations actives. Annulez-les d\'abord.',
        variant: 'destructive',
      })
      setDeleteTarget(null)
      return
    }

    setDeleting(true)
    const { error } = await supabase.from('jet_skis').delete().eq('id', js.id)

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      setJetSkis(prev => prev.filter(j => j.id !== js.id))
      toast({ title: `${js.name} supprimé`, variant: 'success' })
    }
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-end mb-6">
        <Button variant="accent" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un modèle
        </Button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {jetSkis.map(js => (
          <Card key={js.id} className="overflow-hidden card-interactive">
            {/* Color bar */}
            <div className="h-1.5" style={{ backgroundColor: js.color }} />

            {/* Photo */}
            {js.image_url && (
              <div className="relative h-40 w-full bg-slate-100">
                <Image src={js.image_url} alt={js.name} fill className="object-cover" />
              </div>
            )}

            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg leading-tight">{js.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{js.model}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge variant={statusVariant[js.status]}>
                    {JETSKI_STATUS_LABELS[js.status]}
                  </Badge>
                  {!js.booking_enabled && (
                    <Badge
                      variant="destructive"
                      className="flex items-center gap-1 text-[11px]"
                    >
                      <BanIcon className="h-3 w-3" />
                      Réservations bloquées
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Specs */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                  <Zap className="h-4 w-4 mx-auto mb-1 text-slate-400" />
                  <p className="text-sm font-semibold">{js.power_hp} cv</p>
                  <p className="text-xs text-muted-foreground">Puissance</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <Gauge className="h-4 w-4 mx-auto mb-1 text-slate-400" />
                  <p className="text-sm font-semibold">{js.max_speed_kmh}</p>
                  <p className="text-xs text-muted-foreground">km/h max</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <Users className="h-4 w-4 mx-auto mb-1 text-slate-400" />
                  <p className="text-sm font-semibold">{js.capacity}</p>
                  <p className="text-xs text-muted-foreground">Personnes</p>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tarifs</p>
                {([
                  ['1 h',          js.price_1h],
                  ['2 h',          js.price_2h],
                  ['Demi-journée', js.price_4h],
                ] as [string, number][]).map(([label, price]) => (
                  <div key={label} className="flex justify-between text-sm py-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{price} €</span>
                  </div>
                ))}
              </div>

              {/* Booking toggle */}
              <div className="flex items-center justify-between pt-1 border-t">
                <div>
                  <p className="text-sm font-medium">Accepter les réservations</p>
                  <p className="text-xs text-muted-foreground">
                    {js.booking_enabled ? 'Ouvert à la réservation' : 'Bloqué — site public mis à jour'}
                  </p>
                </div>
                <BookingToggle
                  enabled={js.booking_enabled}
                  disabled={togglingId === js.id}
                  onChange={v => handleBookingToggle(js, v)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditTarget(js)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:border-red-200"
                  onClick={() => setDeleteTarget(js)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {jetSkis.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <p className="text-lg mb-2">Aucun modèle dans la flotte</p>
            <Button variant="accent" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Ajouter le premier modèle
            </Button>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un modèle</DialogTitle>
          </DialogHeader>
          <JetSkiForm onSuccess={handleSaved} onCancel={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null) }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <JetSkiForm
              jetSki={editTarget}
              onSuccess={handleSaved}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer {deleteTarget?.name} ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. Les réservations passées associées seront conservées.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
