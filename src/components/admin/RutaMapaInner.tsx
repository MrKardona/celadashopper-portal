'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const tw = 'rgba(255,255,255,'

interface Parada {
  num: number
  label: string
  direccion: string
  tipo: 'paquete' | 'manual'
}

interface GeoParada extends Parada {
  lat: number
  lng: number
}

// Ajusta el mapa a los bounds de los marcadores
function FitBounds({ puntos }: { puntos: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (puntos.length === 0) return
    if (puntos.length === 1) { map.setView(puntos[0], 15); return }
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40] })
  }, [map, puntos])
  return null
}

function markerIcon(num: number, tipo: 'paquete' | 'manual') {
  const color = tipo === 'manual' ? '#818cf8' : '#F5B800'
  const ring  = tipo === 'manual' ? 'rgba(129,140,248,0.3)' : 'rgba(245,184,0,0.3)'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};color:white;
      display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:700;
      border:2.5px solid white;
      box-shadow:0 0 0 3px ${ring},0 3px 10px rgba(0,0,0,0.35);
      font-family:system-ui,sans-serif;
    ">${num}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

async function geocodificar(direccion: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(direccion + ', Colombia')
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&email=celadashopper@gmail.com`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const data = await res.json() as { lat: string; lon: string }[]
    if (!data.length) return null
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  } catch { return null }
}

export default function RutaMapaInner({ paradas }: { paradas: Parada[] }) {
  const [geocoded,   setGeocoded]   = useState<GeoParada[]>([])
  const [cargando,   setCargando]   = useState(false)
  const [progreso,   setProgreso]   = useState(0)
  const abortRef = useRef(false)

  useEffect(() => {
    if (paradas.length === 0) { setGeocoded([]); return }
    abortRef.current = false
    setCargando(true)
    setProgreso(0)
    setGeocoded([])

    ;(async () => {
      const resultados: GeoParada[] = []
      for (let i = 0; i < paradas.length; i++) {
        if (abortRef.current) break
        const p = paradas[i]
        const coords = await geocodificar(p.direccion)
        setProgreso(Math.round(((i + 1) / paradas.length) * 100))
        if (coords) resultados.push({ ...p, lat: coords[0], lng: coords[1] })
        // Nominatim rate limit: 1 req/seg
        if (i < paradas.length - 1) await new Promise(r => setTimeout(r, 1050))
      }
      if (!abortRef.current) setGeocoded(resultados)
      setCargando(false)
    })()

    return () => { abortRef.current = true }
  }, [paradas])

  const puntos: [number, number][] = geocoded.map(g => [g.lat, g.lng])

  // URL para abrir en Google Maps (waypoints)
  const mapsUrl = paradas
    .map(p => encodeURIComponent(p.direccion))
    .join('/')
  const googleMapsUrl = `https://www.google.com/maps/dir/${mapsUrl}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>
            Mapa de ruta
          </p>
          {cargando && (
            <span className="text-[11px]" style={{ color: `${tw}0.35)` }}>
              Geocodificando... {progreso}%
            </span>
          )}
          {!cargando && geocoded.length > 0 && (
            <span className="text-[11px]" style={{ color: `${tw}0.3)` }}>
              {geocoded.length}/{paradas.length} ubicadas
            </span>
          )}
        </div>
        {paradas.length > 0 && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-80"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Ver en Google Maps
          </a>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ height: 340, border: '1px solid rgba(255,255,255,0.08)' }}>
        {geocoded.length === 0 && !cargando ? (
          <div className="h-full flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <svg className="h-8 w-8 opacity-20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <p className="text-xs" style={{ color: `${tw}0.25)` }}>
              {paradas.length === 0 ? 'Sin paradas con dirección' : 'Agregue direcciones para ver el mapa'}
            </p>
          </div>
        ) : cargando && geocoded.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs" style={{ color: `${tw}0.3)` }}>Cargando mapa...</p>
          </div>
        ) : (
          <MapContainer
            center={puntos[0] ?? [6.244, -75.574]}
            zoom={13}
            style={{ height: '100%', width: '100%', background: '#0f0f1a' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
            />
            <FitBounds puntos={puntos} />

            {/* Polilínea de ruta */}
            {puntos.length > 1 && (
              <Polyline
                positions={puntos}
                pathOptions={{ color: '#818cf8', weight: 2.5, opacity: 0.7, dashArray: '6 5' }}
              />
            )}

            {/* Marcadores numerados */}
            {geocoded.map(g => (
              <Marker key={g.num} position={[g.lat, g.lng]} icon={markerIcon(g.num, g.tipo)}>
                <Popup>
                  <div style={{ fontFamily: 'system-ui', fontSize: 13, minWidth: 160 }}>
                    <p style={{ fontWeight: 700, marginBottom: 3 }}>{g.num}. {g.label}</p>
                    <p style={{ color: '#555', fontSize: 11 }}>{g.direccion}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Leyenda */}
      {geocoded.length > 0 && (
        <div className="flex items-center gap-4 text-[11px]" style={{ color: `${tw}0.35)` }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#F5B800' }} /> Paquete sistema
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#818cf8' }} /> Domicilio manual
          </span>
        </div>
      )}
    </div>
  )
}
