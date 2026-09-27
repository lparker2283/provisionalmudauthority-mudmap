import "server-only";
import { db, photoUrl } from "./supabase";
import type { Pin, PublicPin } from "./types";

export function toPublic(pin: Pin): PublicPin {
  return {
    id: pin.id,
    name: pin.name,
    lat: pin.lat,
    lng: pin.lng,
    description: pin.description,
    equipment: pin.equipment,
    viewing_spot: pin.viewing_spot,
    safe_parking: pin.safe_parking,
    parking_note: pin.parking_note,
    last_confirmed_at: pin.last_confirmed_at,
    photo_url: photoUrl(pin.photo_path),
  };
}

export async function getApprovedPins(): Promise<PublicPin[]> {
  const { data, error } = await db()
    .from("pins")
    .select("*")
    .eq("status", "approved")
    .order("last_confirmed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Pin[]).map(toPublic);
}
