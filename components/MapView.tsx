"use client";

import Link from "next/link";
import { useState } from "react";
import LeafletMap from "./MapLoader";
import PinCard from "./PinCard";
import type { PublicPin } from "@/lib/types";

export default function MapView({ pins }: { pins: PublicPin[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [here, setHere] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const selected = pins.find((p) => p.id === selectedId) ?? null;

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="map-page">
      <LeafletMap
        className="map-canvas"
        pins={pins}
        selectedId={selectedId}
        onSelect={setSelectedId}
        flyTo={selected ? [selected.lat, selected.lng] : here}
      />

      {pins.length === 0 && (
        <p className="map-empty notice">
          No sites are on the register yet. The first ones are being scouted in person.{" "}
          <Link href="/add">Know of one?</Link>
        </p>
      )}

      {!selected && (
        <button type="button" className="btn btn-small locate-btn" onClick={locate} disabled={locating}>
          {locating ? "Locating…" : "Near me"}
        </button>
      )}

      {selected && <PinCard key={selected.id} pin={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
