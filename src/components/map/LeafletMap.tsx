'use client'

import { useEffect } from 'react'
import { MapContainer, ImageOverlay, Polygon, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

import 'leaflet/dist/leaflet.css'

export interface AreaFeature {
  id: number
  center: [number, number]
  polygon?: [number, number][] | null
}

export interface MapData {
  mapId: string
  mapName: string
  range: string
  image: string
  imageSize: [number, number]
  bounds: [[number, number], [number, number]]
  totalAreas: number
  areas: AreaFeature[]
}

export interface AreaAssignment {
  id: string
  assignedMemberId: string | null
  assignedTo: string | null
  isDispatched: boolean
}

function convertPolygon(polygon: [number, number][]): [number, number][] {
  return polygon.map(([x, y]) => [y, x])
}

/** Fit map to full image bounds whenever bounds change */
function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const t = setTimeout(() => {
      map.fitBounds(bounds, { padding: [0, 0] })
    }, 100)
    return () => clearTimeout(t)
  }, [map, bounds])
  return null
}

export default function LeafletMap({
  mapData,
  selectedIds,
  assignments,
  onToggle,
}: {
  mapData: MapData
  selectedIds: Set<number>
  assignments: Map<number, AreaAssignment>
  onToggle: (id: number) => void
}) {
  return (
    <MapContainer
      bounds={mapData.bounds}
      maxBounds={mapData.bounds}
      crs={L.CRS.Simple}
      style={{ height: '100%', width: '100%', backgroundColor: '#111' }}
      zoomControl={false}
      attributionControl={false}
    >
      <ImageOverlay url={mapData.image} bounds={mapData.bounds} />
      <FitBounds bounds={mapData.bounds} />
      {mapData.areas.map(area => {
        const isSelected = selectedIds.has(area.id)
        const a = assignments.get(area.id)
        const isAssigned = !!a?.isDispatched

        let color = '#4b5563'
        let fill = 0.03
        let weight = 1

        if (isSelected) {
          color = '#3b82f6'
          fill = 0.35
          weight = 2.5
        } else if (isAssigned) {
          color = '#6366f1'
          fill = 0.12
        }

        // Fallback to CircleMarker if no polygon data
        if (!area.polygon || area.polygon.length === 0) {
          return (
            <CircleMarker
              key={area.id}
              center={[area.center[1], area.center[0]]}
              radius={10}
              pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: isSelected ? 0.5 : isAssigned ? 0.3 : 0.08 }}
              eventHandlers={{ click: () => onToggle(area.id) }}
            >
              <Tooltip direction="center" offset={[0, 0]} opacity={0.85} permanent>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{area.id}</span>
              </Tooltip>
            </CircleMarker>
          )
        }

        return (
          <Polygon
            key={area.id}
            positions={convertPolygon(area.polygon)}
            pathOptions={{ color, weight, fillColor: color, fillOpacity: fill, opacity: 0.6 }}
            eventHandlers={{ click: () => onToggle(area.id) }}
          >
            <Tooltip direction="center" offset={[0, 0]} opacity={0.85} permanent>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{area.id}</span>
            </Tooltip>
          </Polygon>
        )
      })}
    </MapContainer>
  )
}
