"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { DEFAULT_ZOOM, ROCHESTER_CENTER, isStale } from "@/lib/constants";
import type { PublicPin } from "@/lib/types";

// Leaflet's default marker images don't survive bundling; draw pins in CSS.
function pinIcon(className: string) {
  return L.divIcon({
    className: "",
    html: `<div class="pin-marker ${className}"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 36],
  });
}

export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, target]);
  return null;
}

function Clicks({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

type Props = {
  pins?: PublicPin[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** A single draggable "draft" marker, for the submission form. */
  draft?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  flyTo?: [number, number] | null;
  className?: string;
};

export default function LeafletMap({ pins = [], selectedId, onSelect, draft, onPick, flyTo, className }: Props) {
  const now = Date.now();
  return (
    <MapContainer
      center={ROCHESTER_CENTER}
      zoom={DEFAULT_ZOOM}
      className={className}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
      <FlyTo target={flyTo ?? null} />
      {onPick && <Clicks onClick={onPick} />}
      {!onPick && onSelect && <Clicks onClick={() => onSelect(null)} />}

      {pins.map((p) => {
        const stale = isStale(p.last_confirmed_at, now);
        const cls = [stale && "is-stale", p.id === selectedId && "is-selected"].filter(Boolean).join(" ");
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(cls)}
            title={p.name ?? p.description.slice(0, 60)}
            alt={p.name ?? "Construction site"}
            keyboard
            zIndexOffset={stale ? -100 : 0}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          />
        );
      })}

      {draft && (
        <Marker
          position={[draft.lat, draft.lng]}
          icon={pinIcon("is-draft")}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onPick?.(ll.lat, ll.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
