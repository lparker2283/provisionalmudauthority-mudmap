export type PinStatus = "pending" | "approved";

export type Pin = {
  id: string;
  status: PinStatus;
  name: string | null;
  lat: number;
  lng: number;
  description: string;
  equipment: string | null;
  viewing_spot: string | null;
  safe_parking: boolean;
  parking_note: string | null;
  photo_path: string | null;
  last_confirmed_at: string;
  approved_at: string | null;
  created_at: string;
};

// What the public map receives: no moderation fields, photo resolved to a URL.
export type PublicPin = Omit<Pin, "status" | "approved_at" | "created_at" | "photo_path"> & {
  photo_url: string | null;
};

export type Report = {
  id: string;
  pin_id: string;
  reason: string;
  note: string | null;
  status: "open" | "dismissed";
  created_at: string;
};
