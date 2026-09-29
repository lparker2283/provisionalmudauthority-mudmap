"use client";

import { useRef, useState } from "react";
import LeafletMap from "./MapLoader";
import AddressSearch from "./AddressSearch";
import { LIMITS, MAX_PHOTO_BYTES, inServiceArea } from "@/lib/constants";

type Result = { ok: true } | { ok: false; error: string };
type UploadResult = { ok: true; path: string; url: string } | { ok: false; error: string };

type Props = {
  mode: "public" | "admin";
  submitAction: (values: Record<string, unknown>) => Promise<Result>;
  uploadAction: (contentType: string) => Promise<UploadResult>;
  onSubmitted?: () => void;
};

const MAX_EDGE = 2000;

// Re-encode the photo in the browser: shrinks phone photos well under the
// limit and strips EXIF metadata (including GPS) before anything is uploaded.
async function preparePhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo format can’t be read in this browser. Please try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not process that photo. Please try another.");
  if (blob.size > MAX_PHOTO_BYTES) throw new Error("That photo is over 5 MB even after resizing. Please try another.");
  return blob;
}

export default function SiteForm({ mode, submitAction, uploadAction, onSubmitted }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [startedAt] = useState(() => Date.now());
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  // Bumped to clear the address box when the admin form resets.
  const [searchKey, setSearchKey] = useState(0);
  const [locError, setLocError] = useState<string | null>(null);
  const [safeParking, setSafeParking] = useState<"yes" | "no" | "">("");
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function pick(lat: number, lng: number, fly = false) {
    if (!inServiceArea(lat, lng)) {
      setLocError("That spot is outside greater Rochester.");
      return;
    }
    setLocError(null);
    setPoint({ lat, lng });
    if (fly) setFlyTo([lat, lng]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setLocError("Location isn’t available on this device.");
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => pick(pos.coords.latitude, pos.coords.longitude, true),
      () => setLocError("Couldn’t get your location. Search an address or tap the map instead."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
    if (!file) return;
    try {
      const blob = await preparePhoto(file);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch (err) {
      setPhotoError((err as Error).message);
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!point) return setError("Please mark the site on the map.");
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = Object.fromEntries(fd.entries());
    values.lat = point.lat;
    values.lng = point.lng;
    values.safe_parking = safeParking;
    values.started_at = startedAt;
    delete values.photo;

    setStatus("sending");
    try {
      if (photo) {
        const up = await uploadAction("image/jpeg");
        if (!up.ok) throw new Error(up.error);
        const put = await fetch(up.url, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
          body: photo.blob,
        });
        if (!put.ok) throw new Error("The photo didn’t upload. Try again, or remove it and submit without one.");
        values.photo_path = up.path;
      }
      const res = await submitAction(values);
      if (!res.ok) throw new Error(res.error);
    } catch (err) {
      setStatus("idle");
      setError((err as Error).message);
      return;
    }

    if (mode === "admin") {
      // Ready for the next one.
      formRef.current?.reset();
      setPoint(null);
      setSafeParking("");
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto(null);
      setSearchKey((k) => k + 1);
      setStatus("idle");
      onSubmitted?.();
      return;
    }
    setStatus("done");
    window.scrollTo({ top: 0 });
  }

  if (status === "done") {
    return (
      <div>
        <div className="stamp" aria-hidden="true">Received</div>
        <h2>Your filing is in the queue</h2>
        <p>
          Thank you. A person will look at it before it appears on the map, usually within a few days. Nothing
          you submitted is public until then.
        </p>
        <p>
          <a href="/">Back to the map</a> · <a href="/add">File another site</a>
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      {/* Honeypot. Leave empty. */}
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="field">
        <span className="field-label">1. Where is it?</span>
        <span className="field-hint">Start typing an address, use your location, or tap the map. You can drag the pin to adjust.</span>
        <AddressSearch key={searchKey} onPick={(h) => pick(h.lat, h.lng, true)} />
        <button type="button" className="btn btn-quiet btn-small" onClick={useMyLocation} style={{ marginBottom: 8 }}>
          Use my location
        </button>
        <div className="picker-wrap">
          <LeafletMap className="picker-map" draft={point} onPick={(lat, lng) => pick(lat, lng)} flyTo={flyTo} />
        </div>
        <p className="picker-status" aria-live="polite">
          {point ? `Marked at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "No location marked yet."}
        </p>
        {locError && <p className="error">{locError}</p>}
      </div>

      {mode === "admin" && (
        <label className="field">
          <span className="field-label">Site name (optional)</span>
          <input type="text" name="name" maxLength={LIMITS.name} />
        </label>
      )}
      {mode === "public" && (
        <label className="field">
          <span className="field-label">2. What should we call it? (optional)</span>
          <span className="field-hint">A street or project name, like “Inner Loop North”.</span>
          <input type="text" name="name" maxLength={LIMITS.name} />
        </label>
      )}

      <label className="field">
        <span className="field-label">{mode === "public" && "3. "}Short description</span>
        <span className="field-hint">What’s happening there, in a sentence or two.</span>
        <textarea name="description" maxLength={LIMITS.description} rows={3} required />
      </label>

      <label className="field">
        <span className="field-label">{mode === "public" && "4. "}Equipment visible</span>
        <span className="field-hint">Excavators, dump trucks, a crane, a roller…</span>
        <input type="text" name="equipment" maxLength={LIMITS.equipment} />
      </label>

      <label className="field">
        <span className="field-label">{mode === "public" && "5. "}Best viewing spot</span>
        <span className="field-hint">Where a small person gets the best view.</span>
        <input type="text" name="viewing_spot" maxLength={LIMITS.viewingSpot} />
      </label>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 20px" }}>
        <legend className="field-label">{mode === "public" && "6. "}Safe parking or a sidewalk to stand on?</legend>
        <div className="choice-row">
          <label className="choice">
            <input type="radio" name="safe_parking_choice" checked={safeParking === "yes"} onChange={() => setSafeParking("yes")} />
            Yes
          </label>
          <label className="choice">
            <input type="radio" name="safe_parking_choice" checked={safeParking === "no"} onChange={() => setSafeParking("no")} />
            No / not sure
          </label>
        </div>
        <label style={{ marginTop: 10 }}>
          <span className="field-hint">Where to park or stand (optional)</span>
          <input type="text" name="parking_note" maxLength={LIMITS.parkingNote} />
        </label>
      </fieldset>

      <div className="field">
        <label htmlFor="photo" className="field-label">
          {mode === "public" && "7. "}Photo (optional)
        </label>
        <p className="notice" style={{ margin: "6px 0 10px" }}>
          <strong>Photos of sites and machines only. No photos of people</strong>, including workers and
          children. Photos that show people will be rejected. One photo, up to 5 MB.
        </p>
        <input id="photo" type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={onPhoto} />
        {photoError && <p className="error">{photoError}</p>}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="photo-preview" src={photo.preview} alt="Your photo, ready to upload" />
        )}
      </div>

      {mode === "public" && (
        <p className="field-hint">
          Submissions are reviewed by a person before they appear on the map. No account, no email, nothing
          else is collected.
        </p>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={status === "sending"} style={{ width: "100%" }}>
        {status === "sending" ? "Filing…" : mode === "admin" ? "Add to map and start another" : "Submit for review"}
      </button>
    </form>
  );
}
