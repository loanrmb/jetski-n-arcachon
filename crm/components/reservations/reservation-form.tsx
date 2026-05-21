'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { calcPrice, slotEndTime } from '@/lib/utils'
import { SLOT_TIMES, SOURCE_LABELS, type JetSki, type ReservationSource } from '@/types'
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
  caution_collected: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

interface ReservationFormProps {
  defaultDate?: string
  defaultSlot?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ReservationForm({ defaultDate, defaultSlot, onSuccess, onCancel }: ReservationFormProps) {
  const [jetSkis, setJetSkis]   = useState<JetSki[]>([])
  const [loading, setLoading]   = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:             defaultDate ?? new Date().toISOString().split('T')[0],
      slot_time:        defaultSlot ?? '09:00',
      duration_hours:   1,
      nb_persons:       1,
      source:           'phone',
      license_verified: 'not_verified',
      caution_collected: false,
    },
  })

  const watchedJetSkiId = watch('jet_ski_id')
  const watchedDuration = watch('duration_hours')
  const selectedJetSki  = jetSkis.find(j => j.id === watchedJetSkiId)
  const price           = selectedJetSki ? calcPrice(selectedJetSki, watchedDuration) : null

  useEffect(() => {
    supabase
      .from('jet_skis')
      .select('*')
      .eq('status', 'active')
      .then(({ data }) => setJetSkis((data ?? []) as JetSki[]))
  }, [])

  async function onSubmit(data: FormData) {
    setLoading(true)

    // Upsert client (dédoublonnage par email)
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .upsert({ first_name: data.first_name, last_name: data.last_name, email: data.email, phone: data.phone }, { onConflict: 'email' })
      .select()
      .single()

    if (clientErr || !client) {
      toast({ title: 'Erreur', description: 'Impossible de créer le client.', variant: 'destructive' })
      setLoading(false)
      return
    }

    const { error: resErr } = await supabase.from('reservations').insert({
      jet_ski_id:        data.jet_ski_id,
      client_id:         client.id,
      date:              data.date,
      slot_time:         data.slot_time,
      duration_hours:    data.duration_hours,
      nb_persons:        data.nb_persons,
      source:            data.source,
      license_verified:  data.license_verified,
      client_message:    data.client_message,
      internal_note:     data.internal_note,
      caution_collected: data.caution_collected ?? false,
      price_total:       price ?? 0,
      status:            'confirmed',
    })

    if (resErr) {
      toast({ title: 'Erreur', description: resErr.message, variant: 'destructive' })
      setLoading(false)
      return
    }

    toast({ title: 'Réservation créée', variant: 'success' })
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Client */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Client</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="first_name">Prénom</Label>
            <Input id="first_name" {...register('first_name')} />
            {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="last_name">Nom</Label>
            <Input id="last_name" {...register('last_name')} />
            {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" type="tel" {...register('phone')} />
          </div>
        </div>
      </fieldset>

      {/* Réservation */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Réservation</legend>

        <div className="space-y-1">
          <Label>Jet ski</Label>
          <Select onValueChange={v => setValue('jet_ski_id', v)}>
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
          {errors.jet_ski_id && <p className="text-xs text-destructive">Requis</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>
          <div className="space-y-1">
            <Label>Créneau</Label>
            <Select defaultValue={defaultSlot ?? '09:00'} onValueChange={v => setValue('slot_time', v)}>
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
            <Select defaultValue="1" onValueChange={v => setValue('duration_hours', Number(v) as 1 | 2 | 4)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 heure</SelectItem>
                <SelectItem value="2">2 heures</SelectItem>
                <SelectItem value="4">Demi-journée (4h)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nb_persons">Personnes (max 3)</Label>
            <Input id="nb_persons" type="number" min={1} max={3} {...register('nb_persons')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Source</Label>
            <Select defaultValue="phone" onValueChange={v => setValue('source', v as ReservationSource)}>
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
            <Select defaultValue="not_verified" onValueChange={v => setValue('license_verified', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Oui</SelectItem>
                <SelectItem value="no">Non</SelectItem>
                <SelectItem value="not_verified">Non vérifié</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      {/* Prix calculé */}
      {price && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-orange-800">Prix estimé</span>
          <span className="font-bold text-orange-900">{price} €</span>
        </div>
      )}

      {/* Notes */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Notes</legend>
        <div className="space-y-1">
          <Label htmlFor="client_message">Message client</Label>
          <Textarea id="client_message" rows={2} {...register('client_message')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="internal_note">Note interne (non visible client)</Label>
          <Textarea id="internal_note" rows={2} {...register('internal_note')} />
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" variant="accent" disabled={loading}>
          {loading ? 'Création…' : 'Créer la réservation'}
        </Button>
      </div>
    </form>
  )
}
