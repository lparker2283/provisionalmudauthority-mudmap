import { NextResponse, type NextRequest } from "next/server";
import { ROCHESTER_CENTER, SERVICE_AREA, inServiceArea } from "@/lib/constants";
import { rateLimit } from "@/lib/request";
import type { GeocodeHit } from "@/lib/types";

// Address suggestions as you type, from Photon (https://photon.komoot.io):
// free OpenStreetMap geocoding built for autocomplete. Nominatim's usage
// policy forbids autocomplete, so it isn't used here. Requests go through
// this route rather than straight from the browser so visitors' IPs aren't
// passed on, and so one client can't burn through the shared public service.

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

function label(p: PhotonFeature["properties"]): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const place = p.city ?? p.town ?? p.village ?? p.district ?? p.county;
  const parts = [p.name, street, place].filter((s): s is string => !!s);
  return [...new Set(parts)].join(", ");
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 3) return NextResponse.json({ hits: [] });

  // Generous enough for typing (requests are debounced client-side).
  if (!(await rateLimit("geocode", 150, 10))) {
    return NextResponse.json({ error: "Address search is resting. Try again in a few minutes, or tap the map." }, { status: 429 });
  }

  const { west, south, east, north } = SERVICE_AREA;
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");
  url.searchParams.set("bbox", `${west},${south},${east},${north}`);
  url.searchParams.set("lat", String(ROCHESTER_CENTER[0]));
  url.searchParams.set("lon", String(ROCHESTER_CENTER[1]));

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PMA-ConstructionMap/1.0 (https://map.provisionalmudauthority.com)" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = (await res.json()) as { features?: PhotonFeature[] };

    const seen = new Set<string>();
    const hits: GeocodeHit[] = [];
    for (const f of data.features ?? []) {
      const [lng, lat] = f.geometry.coordinates;
      const text = label(f.properties);
      if (!text || seen.has(text) || !inServiceArea(lat, lng)) continue;
      seen.add(text);
      hits.push({ label: text, lat, lng });
    }
    return NextResponse.json({ hits }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    console.error("geocode", e);
    return NextResponse.json({ error: "Address search is unavailable right now. You can tap the map instead." }, { status: 502 });
  }
}
