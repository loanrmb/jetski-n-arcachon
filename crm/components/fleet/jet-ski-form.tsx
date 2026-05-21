'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { JETSKI_STATUS_LABELS, type JetSki, type JetSkiStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

const schema = z.object({
  name:          z.string().min(1, 'Requis'),
  model:         z.string().min(1, 'Requis'),
  power_hp:      z.coerce.number().min(1, 'Requis'),
  max_speed_kmh: z.coerce.number().min(1, 'Requis'),
  capacity:      z.coerce.number().min(1).max(5),
  price_1h:      z.coerce.number().min(0),
  price_2h:      z.coerce.number().min(0),
  price_4h:      z.coerce.number().min(0),
  status:        z.enum(['active', 'maintenance', 'out_of_service']),
  image_url:     z.string().url('URL invalide').optional().or(z.literal('')),
  color:         z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide'),
})

type FormData = z.infer<typeof schema>

interface Props {
  jetSki?: JetSki          // undefined = create, defined = edit
  onSuccess: (saved: JetSki) => void
  onCancel: () => void
}

export function JetSkiForm({ jetSki, onSuccess, onCancel }: Props) {
  const isEdit = !!jetSki
  const supabase = createClient()

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:          jetSki?.name          ?? '',
      model:         jetSki?.model         ?? '',
      power_hp:      jetSki?.power_hp      ?? 130,
      max_speed_kmh: jetSki?.max_speed_kmh ?? 75,
      capacity:      jetSki?.capacity      ?? 3,
      price_1h:      jetSki?.price_1h      ?? 110,
      price_2h:      jetSki?.price_2h      ?? 200,
      price_4h:      jetSki?.price_4h      ?? 380,
      status:        jetSki?.status        ?? 'active',
      image_url:     jetSki?.image_url     ?? '',
      color:         jetSki?.color         ?? '#3B82F6',
    },
  })

  const watchColor = watch('color')

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      image_url: data.image_url || null,
    }

    const { data: saved, error } = isEdit
      ? await supabase.from('jet_skis').update(payload).eq('id', jetSki.id).select().single()
      : await supabase.from('jet_skis').insert(payload).select().single()

    if (error || !saved) {
      toast({ title: 'Erreur', description: error?.message ?? 'Erreur inconnue', variant: 'destructive' })
      return
    }

    toast({ title: isEdit ? 'Modèle mis à jour' : 'Modèle ajouté', variant: 'success' })
    onSuccess(saved as JetSki)
  }

  const statusEntries = Object.entries(JETSKI_STATUS_LABELS) as [JetSkiStatus, string][]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Identité */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Identité</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="js_name">Nom court</Label>
            <Input id="js_name" placeholder="GTI SE 130" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="js_model">Modèle complet</Label>
            <Input id="js_model" placeholder="Sea-Doo GTI SE 130" {...register('model')} />
            {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="js_image">Photo (URL)</Label>
          <Input id="js_image" type="url" placeholder="https://…" {...register('image_url')} />
          {errors.image_url && <p className="text-xs text-destructive">{errors.image_url.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Statut</Label>
            <Select
              defaultValue={jetSki?.status ?? 'active'}
              onValueChange={v => setValue('status', v as JetSkiStatus)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusEntries.map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="js_color">Couleur calendrier</Label>
            <div className="flex items-center gap-2">
              <input
                id="js_color"
                type="color"
                defaultValue={jetSki?.color ?? '#3B82F6'}
                className="h-9 w-14 cursor-pointer rounded-md border border-input p-1"
                onChange={e => setValue('color', e.target.value)}
              />
              <Input
                value={watchColor}
                onChange={e => setValue('color', e.target.value)}
                className="font-mono text-xs"
                maxLength={7}
              />
            </div>
            {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
          </div>
        </div>
      </fieldset>

      {/* Caractéristiques */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Caractéristiques</legend>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="js_power">Puissance (cv)</Label>
            <Input id="js_power" type="number" min={1} {...register('power_hp')} />
            {errors.power_hp && <p className="text-xs text-destructive">{errors.power_hp.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="js_speed">Vitesse max (km/h)</Label>
            <Input id="js_speed" type="number" min={1} {...register('max_speed_kmh')} />
            {errors.max_speed_kmh && <p className="text-xs text-destructive">{errors.max_speed_kmh.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="js_capacity">Capacité</Label>
            <Input id="js_capacity" type="number" min={1} max={5} {...register('capacity')} />
          </div>
        </div>
      </fieldset>

      {/* Tarifs */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">Tarifs (€)</legend>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="js_p1">1 heure</Label>
            <Input id="js_p1" type="number" step="0.01" min={0} {...register('price_1h')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="js_p2">2 heures</Label>
            <Input id="js_p2" type="number" step="0.01" min={0} {...register('price_2h')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="js_p4">Demi-journée (4h)</Label>
            <Input id="js_p4" type="number" step="0.01" min={0} {...register('price_4h')} />
          </div>
        </div>
      </fieldset>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? 'Sauvegarde…' : isEdit ? 'Enregistrer' : 'Ajouter le modèle'}
        </Button>
      </div>
    </form>
  )
}
