import { LIMITS, inServiceArea } from "./constants";

export type PinInput = {
  name: string | null;
  lat: number;
  lng: number;
  description: string;
  equipment: string | null;
  viewing_spot: string | null;
  safe_parking: boolean;
  parking_note: string | null;
};

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+\n/g, "\n");
  if (!t) return null;
  return t.slice(0, max);
}

// Validates untrusted pin fields. Returns an error message or the clean input.
export function parsePinInput(raw: Record<string, unknown>): { error: string } | { value: PinInput } {
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Please mark the site on the map." };
  }
  if (!inServiceArea(lat, lng)) {
    return { error: "That location is outside greater Rochester. The Authority's jurisdiction is limited." };
  }
  const description = text(raw.description, LIMITS.description);
  if (!description) return { error: "Please add a short description of the site." };

  return {
    value: {
      name: text(raw.name, LIMITS.name),
      lat,
      lng,
      description,
      equipment: text(raw.equipment, LIMITS.equipment),
      viewing_spot: text(raw.viewing_spot, LIMITS.viewingSpot),
      safe_parking: raw.safe_parking === true || raw.safe_parking === "yes",
      parking_note: text(raw.parking_note, LIMITS.parkingNote),
    },
  };
}

// Photo paths are issued by the server as pending/<uuid>.<ext>.
export function isValidPhotoPath(p: unknown): p is string {
  return (
    typeof p === "string" &&
    /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(p)
  );
}
