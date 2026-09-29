"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GeocodeHit } from "@/lib/types";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

// Address field with suggestions as you type (an ARIA combobox). Arrow keys
// move through suggestions, Enter picks, Escape closes.
export default function AddressSearch({ onPick }: { onPick: (hit: GeocodeHit) => void }) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Set after a pick so the chosen label doesn't trigger a fresh search.
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setHits([]);
      setOpen(false);
      setMessage(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = (await res.json()) as { hits?: GeocodeHit[]; error?: string };
        const found = data.hits ?? [];
        setHits(found);
        setActive(-1);
        setOpen(true);
        setMessage(data.error ?? (found.length === 0 ? "No match in greater Rochester. Try adding the town, or tap the map." : null));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setMessage("Address search is unavailable right now. You can tap the map instead.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(hit: GeocodeHit) {
    skipNext.current = true;
    setQuery(hit.label);
    setOpen(false);
    setHits([]);
    setMessage(null);
    onPick(hit);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Never submit the whole form from the address box.
      e.preventDefault();
      const hit = hits[active >= 0 ? active : 0];
      if (open && hit) choose(hit);
    } else if (e.key === "ArrowDown" && hits.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp" && hits.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && hits.length > 0;

  return (
    <div className="address-search">
      <input
        type="search"
        role="combobox"
        aria-label="Search an address"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Start typing an address or place"
        autoComplete="off"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && <span className="address-loading" aria-hidden="true">…</span>}
      {showList && (
        <ul className="search-hits" id={listId} role="listbox">
          {hits.map((h, i) => (
            <li key={h.label} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              {/* onMouseDown so the pick lands before the input's blur closes the list */}
              <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); choose(h); }}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && !showList && <p className="picker-status">{message}</p>}
    </div>
  );
}
