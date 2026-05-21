'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { calcPrice } from '@/lib/utils'
import {
  SLOT_TIMES, SOURCE_LABELS, LICENSE_LABELS,
  type JetSki, type ReservationSource, type LicenseVerified,
} from '@/types'
import type { ReservationWithJoins } from './reservation-detail'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

const schema = z.object({
  first_name:        z.string().min(1, 'Requis'),
  last_name:         z.string().min(1, 'Requis'),
  email:             z.string().email('Email invalide'),
  phone:             z.string().optional(),
  jet_ski_id:        z.string().min(1, 'Requis'),
  date:              z.string().min(1, 'Requis'),
  slot_time:         z.string().min(1, 'Requis'),
  duration_hours:    z.coerce.number().refine(v => [1, 2, 4].includes(v)),
  nb_persons:        z.coerce.number().min(1).max(3),
  source:            z.enum(['online', 'phone', 'on_site']),
  license_verified:  z.enum(['yes', 'no', 'not_verified']),
  client_message:    z.string().optional(),
  internal_note:     z.string().optional(),
  fuel_note:         z.string().optional(),
  caution_collected: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  reservation: ReservationWithJoins
  onSuccess: () => void
  onCancel: () => void
}

export function ReservationEditForm({ reservation: r, onSuccess, onCancel }: Props) {
  const [jetSkis, setJetSkis] = useState<JetSki[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name:        r.client?.first_name  ?? '',
      last_name:         r.client?.last_name   ?? '',
      email:             r.client?.email        ?? '',
      phone:             r.client?.phone        ?? '',
      jet_ski_id:        r.jet_ski_id,
      date:              r.date,
      // Supabase returns TIME as "09:00:00" — trim to "09:00"
      slot_time:         r.slot_time.slice(0, 5),
      duration_hours:    Number(r.duration_hours) as 1 | 2 | 4,
      nb_persons:        r.nb_persons,
      source:            r.source,
      license_verified:  r.license_verified,
      client_message:    r.client_message   ?? '',
      internal_note:     r.internal_note    ?? '',
      fuel_note:         r.fuel_note        ?? '',
      caution_collected: r.caution_collected,
    },
  })

  const watchedJetSkiId = watch('jet_ski_id')
  const watchedDuration = watch('duration_hours')
  const selectedJetSki  = jetSkis.find(j => j.id === watchedJetSkiId) ?? r.jet_ski
  const price           = selectedJetSki ? calcPrice(selectedJetSki, watchedDuration) : null

  useEffect(() => {
    supabase
      .from('jet_skis')
      .select('*')
      .then(({ data }) => setJetSkis((data ?? []) as JetSki[]))
  }, [])

  async function onSubmit(data: FormData) {
    setLoading(true)

    // Update client record
    if (r.client_id) {
      await supabase
        .from('clients')
        .update({
          first_name: data.first_name,
          last_name:  data.last_name,
          email:      data.email,
          phone:      data.phone ?? null,
        })
        .eq('id', r.client_id)
    }

    // Update reservation
    const { error } = await supabase
      .from('reservations')
      .update({
        jet_ski_id:        data.jet_ski_id,
        date:              data.date,
        slot_time:         data.slot_time,
        duration_hours:    data.duration_hours,
        nb_persons:        data.nb_persons,
        source:            data.source,
        license_verified:  data.license_verified,
        client_message:    data.client_message    ?? null,
        internal_note:     data.internal_note     ?? null,
        fuel_note:         data.fuel_note          ?? null,
        caution_collected: data.caution_collected ?? false,
        price_total:       price ?? r.price_total,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', r.id)

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Réservation mise à jour', variant: 'success' })
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Client */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Client</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit_first_name">Prénom</Label>
            <Input id="edit_first_name" {...register('first_name')} />
            {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit_last_name">Nom</Label>
            <Input id="edit_last_name" {...register('last_name')} />
            {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit_email">Email</Label>
            <Input id="edit_email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit_phone">Téléphone</Label>
            <Input id="edit_phone" type="tel" {...register('phone')} />
          </div>
        </div>
      </fieldset>

      {/* Réservation */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Réservation</legend>

        <div className="space-y-1">
          <Label>Jet ski</Label>
          <Select
            defaultValue={r.jet_ski_id}
            onValueChange={v => setValue('jet_ski_id', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un modèle…" />
            </SelectTrigger>
            <SelectContent>
              {jetSkis.map(j => (
                <SelectItem key={j.id} value={j.id}>
                  {j.name} — {j.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit_date">Date</Label>
            <Input id="edit_date" type="date" {...register('date')} />
          </div>
          <div className="space-y-1">
            <Label>Créneau</Label>
            <Select
              defaultValue={r.slot_time.slice(0, 5)}
              onValueChange={v => setValue('slot_time', v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SLOT_TIMES.map(t => (
                  <SelectItem key={t} value={t}>{t.replace(':', 'h')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Durée</Label>
            <Select
              defaultValue={String(r.duration_hours)}
              onValueChange={v => setValue('duration_hours', Number(v) as 1 | 2 | 4)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 heure</SelectItem>
                <SelectItem value="2">2 heures</SelectItem>
                <SelectItem value="4">Demi-journée (4h)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit_nb_persons">Personnes (max 3)</Label>
            <Input id="edit_nb_persons" type="number" min={1} max={3} {...register('nb_persons')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Source</Label>
            <Select
              defaultValue={r.source}
              onValueChange={v => setValue('source', v as ReservationSource)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(SOURCE_LABELS) as [ReservationSource, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Permis côtier</Label>
            <Select
              defaultValue={r.license_verified}
              onValueChange={v => setValue('license_verified', v as LicenseVerified)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(LICENSE_LABELS) as [LicenseVerified, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="edit_caution"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            defaultChecked={r.caution_collected}
            onChange={e => setValue('caution_collected', e.target.checked)}
          />
          <Label htmlFor="edit_caution">Caution encaissée</Label>
        </div>
      </fieldset>

      {/* Prix recalculé */}
      {price !== null && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-orange-800">Prix recalculé</span>
          <span className="font-bold text-orange-900">{price} €</span>
        </div>
      )}

      {/* Notes */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Notes</legend>
        <div className="space-y-1">
          <Label htmlFor="edit_client_message">Message client</Label>
          <Textarea id="edit_client_message" rows={2} {...register('client_message')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit_internal_note">Note interne (non visible client)</Label>
          <Textarea id="edit_internal_note" rows={2} {...register('internal_note')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit_fuel_note">Carburant</Label>
          <Textarea id="edit_fuel_note" rows={2} placeholder="Litres consommés, remarques…" {...register('fuel_note')} />
        </div>
      </fieldset>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" variant="accent" disabled={loading}>
          {loading ? 'Sauvegarde…' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  )
}
