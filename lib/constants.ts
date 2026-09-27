// Shared, client-safe constants.

export const ROCHESTER_CENTER: [number, number] = [43.1566, -77.6088];
export const DEFAULT_ZOOM = 12;

// Rough bounding box for "greater Rochester": Monroe County plus a margin.
// Submissions outside it are refused.
export const SERVICE_AREA = {
  south: 42.8,
  north: 43.4,
  west: -78.2,
  east: -77.1,
};

export const STALE_AFTER_DAYS = 60;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_BUCKET = "pin-photos";

export const LIMITS = {
  name: 80,
  description: 500,
  equipment: 300,
  viewingSpot: 300,
  parkingNote: 300,
  reportNote: 500,
};

export const REPORT_REASONS = {
  finished: "The site is finished or quiet",
  unsafe: "The viewing spot is unsafe",
  inaccurate: "Something here is wrong",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export function inServiceArea(lat: number, lng: number) {
  return (
    lat >= SERVICE_AREA.south &&
    lat <= SERVICE_AREA.north &&
    lng >= SERVICE_AREA.west &&
    lng <= SERVICE_AREA.east
  );
}

export function isStale(lastConfirmedAt: string, now = Date.now()) {
  const age = now - new Date(lastConfirmedAt).getTime();
  return age > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/New_York",
  });
}
