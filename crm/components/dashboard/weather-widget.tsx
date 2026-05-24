'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Wind, Thermometer, CloudSun } from 'lucide-react'

const BASE_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=44.66&longitude=-1.17' +
  '&current=temperature_2m,windspeed_10m,weathercode' +
  '&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max' +
  '&wind_speed_unit=kmh&forecast_days=4&timezone=Europe%2FParis'

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function emojiForCode(code: number): string {
  if (code <= 2)                                                 return '☀️'
  if (code === 3)                                                return '🌤'
  if (code === 45 || code === 48)                                return '🌫'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧'
  if (code >= 71 && code <= 77)                                  return '❄️'
  if (code >= 95)                                                return '⛈'
  return '🌥'
}

interface WeatherData {
  current: {
    temperature_2m:  number
    windspeed_10m:   number
    weathercode:     number
  }
  daily: {
    time:              string[]
    weathercode:       number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    windspeed_10m_max:  number[]
  }
}

export function WeatherWidget() {
  const [weather, setWeather]   = useState<WeatherData | null>(null)
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch(BASE_URL)
      .then(r => r.json())
      .then(data => { setWeather(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CloudSun className="h-4 w-4" />Météo Arcachon</CardTitle></CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
            Chargement…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !weather) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CloudSun className="h-4 w-4" />Météo Arcachon</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Données indisponibles.</p>
        </CardContent>
      </Card>
    )
  }

  const { current, daily } = weather
  const windWarning = current.windspeed_10m > 40

  // Forecast: days 1-3 (skip today = index 0)
  const forecast = daily.time.slice(1, 4).map((dateStr, i) => {
    const idx = i + 1
    const d   = new Date(dateStr + 'T12:00:00')
    return {
      day:  DAYS_FR[d.getDay()],
      emoji: emojiForCode(daily.weathercode[idx]),
      max:   Math.round(daily.temperature_2m_max[idx]),
      min:   Math.round(daily.temperature_2m_min[idx]),
    }
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CloudSun className="h-4 w-4" />
          Météo Arcachon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Wind warning */}
        {windWarning && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-xs font-semibold text-red-700">
              Conditions difficiles — vérifier les sorties
            </p>
          </div>
        )}

        {/* Current conditions */}
        <div className="flex items-center gap-4">
          <span className="text-4xl leading-none" aria-hidden>{emojiForCode(current.weathercode)}</span>
          <div>
            <p className="text-2xl font-bold leading-none">
              {Math.round(current.temperature_2m)}°C
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Wind className="h-3.5 w-3.5" />
              {Math.round(current.windspeed_10m)} km/h
            </p>
          </div>
        </div>

        {/* 3-day forecast */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t">
          {forecast.map(f => (
            <div key={f.day} className="text-center">
              <p className="text-xs font-medium text-muted-foreground mb-1">{f.day}</p>
              <p className="text-xl leading-tight" aria-hidden>{f.emoji}</p>
              <p className="text-xs mt-1">
                <span className="font-semibold">{f.max}°</span>
                <span className="text-muted-foreground"> / {f.min}°</span>
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
