"use client";

import { useEffect, useRef, useState } from "react";
import { reportPin } from "@/app/actions";
import { REPORT_REASONS, STALE_AFTER_DAYS, formatDate, isStale, joinNotes } from "@/lib/constants";
import type { PublicPin } from "@/lib/types";

export default function PinCard({ pin, onClose }: { pin: PublicPin; onClose: () => void }) {
  const stale = isStale(pin.last_confirmed_at);
  const [reporting, setReporting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`;

  return (
    <section className="pin-card" aria-labelledby={`pin-${pin.id}`}>
      <div className="pin-card-head">
        <div>
          <span className="form-no">Excavation on file</span>
          <h2 id={`pin-${pin.id}`} ref={headingRef} tabIndex={-1}>
            {pin.name ?? "Active site"}
          </h2>
        </div>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {stale && (
        <p className="stale-note">
          Not confirmed in over {STALE_AFTER_DAYS} days. The work may be finished. Worth a look before you
          make a special trip.
        </p>
      )}

      {pin.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pin-photo" src={pin.photo_url} alt={`The site${pin.name ? ` at ${pin.name}` : ""}`} loading="lazy" />
      )}

      <p style={{ margin: 0 }}>{pin.description}</p>

      <div className="pin-actions">
        <a className="btn btn-primary" href={directions} target="_blank" rel="noopener noreferrer">
          Directions
        </a>
        {!reporting && (
          <button type="button" className="link-btn" onClick={() => setReporting(true)}>
            Report this pin
          </button>
        )}
      </div>

      <dl className="pin-facts">
        {pin.equipment && (
          <>
            <dt>Equipment seen</dt>
            <dd>{pin.equipment}</dd>
          </>
        )}
        <dt>Safe place to stand</dt>
        <dd>{pin.safe_parking ? "Yes" : "Not confirmed"}</dd>
        {(pin.viewing_spot || pin.parking_note) && (
          <>
            <dt>Where to park and watch</dt>
            <dd>{joinNotes(pin.viewing_spot, pin.parking_note)}</dd>
          </>
        )}
      </dl>

      <p className="confirmed">Last confirmed {formatDate(pin.last_confirmed_at)}</p>

      {reporting && <ReportForm pinId={pin.id} onDone={() => setReporting(false)} />}
    </section>
  );
}

function ReportForm({ pinId, onDone }: { pinId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The form opens below the details; bring it into view.
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError("Please choose a reason.");
    setState("sending");
    setError(null);
    const res = await reportPin(pinId, reason, note);
    if (res.ok) setState("sent");
    else {
      setState("idle");
      setError(res.error);
    }
  }

  if (state === "sent") {
    return (
      <p className="notice" style={{ marginTop: 14 }}>
        Report received. The Authority will review this site. Thank you for keeping the register honest.
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={send} style={{ marginTop: 16 }}>
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
        <legend className="field-label">What’s wrong with this pin?</legend>
        {Object.entries(REPORT_REASONS).map(([value, label]) => (
          <label key={value} className="choice" style={{ width: "100%", marginTop: 8 }}>
            <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span className="field-label">Anything to add? (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="pin-actions" style={{ marginTop: 0 }}>
        <button type="submit" className="btn" disabled={state === "sending"}>
          {state === "sending" ? "Filing…" : "File report"}
        </button>
        <button type="button" className="link-btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
