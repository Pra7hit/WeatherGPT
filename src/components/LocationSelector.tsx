"use client";

import { useEffect, useRef, useState } from "react";

import { useGeolocation } from "@/hooks/useGeolocation";
import type { ClientLocation, Language } from "@/lib/types";
import { t } from "@/lib/uiText";
import type { Place } from "@/services/weather/types";

import { CloseIcon, PinIcon, SearchIcon, SpinnerIcon } from "./icons";

/**
 * Location picker.
 *
 * This only sets a *default* for questions that name no place - a question that
 * says "Mumbai" always wins. Geolocation is requested on the button press only,
 * and city search goes through /api/geocode so the upstream call stays on the
 * server.
 */

function describe(place: Place): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

export function LocationSelector({
  location,
  language,
  onChange,
}: {
  location: ClientLocation | null;
  language: Language;
  onChange: (location: ClientLocation | null) => void;
}) {
  const copy = t(language);
  const geo = useGeolocation();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** Results carry the query they were fetched for, so stale ones are simply not shown. */
  const [found, setFound] = useState<{ query: string; places: Place[] } | null>(null);
  const [searching, setSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Debounced search; a stale response cannot overwrite a newer one, and results
  // for an older query are filtered out at render time rather than cleared here.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { places?: Place[] };
        if (active) setFound({ query: trimmed, places: data.places ?? [] });
      } catch {
        if (active) setFound({ query: trimmed, places: [] });
      } finally {
        if (active) setSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const trimmedQuery = query.trim();
  const results = found?.query === trimmedQuery ? found.places : [];
  const searched = found?.query === trimmedQuery;

  const label = location?.name ?? (location ? `${location.latitude}, ${location.longitude}` : null);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={copy.location}
        className="text-ink-2 hover:bg-surface-2 text-caption flex max-w-[8.5rem] shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium transition-colors duration-150 sm:max-w-[12rem]"
      >
        <PinIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label ?? copy.locationNone}</span>
      </button>

      {open ? (
        <div className="border-line bg-raised shadow-e2 animate-settle absolute right-0 z-30 mt-2 w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border p-3">
          <div className="flex items-center justify-between">
            <p className="text-ink-3 overline">{copy.location}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-3 hover:text-ink hover:bg-surface-2 rounded-md p-1 transition-colors duration-150"
              aria-label="Close"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              const next = await geo.request();
              if (next) {
                onChange(next);
                setOpen(false);
              }
            }}
            disabled={geo.status === "locating"}
            className="border-line text-ink-2 hover:border-accent-line hover:bg-accent-soft hover:text-accent-ink text-caption mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 transition-colors duration-150 disabled:opacity-60"
          >
            {geo.status === "locating" ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              <PinIcon className="h-4 w-4" />
            )}
            <span>{geo.status === "locating" ? copy.locating : copy.useMyLocation}</span>
          </button>

          {geo.error ? (
            <p className="text-sev-moderate-ink text-caption mt-1.5">{geo.error}</p>
          ) : null}

          <div className="border-line focus-within:border-accent-line focus-within:outline-ring mt-3 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2">
            <SearchIcon className="text-ink-3 h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              className="text-ink placeholder:text-ink-3 focus-quiet text-caption w-full bg-transparent outline-none"
            />
            {searching ? <SpinnerIcon className="text-ink-3 h-4 w-4" /> : null}
          </div>

          {results.length > 0 ? (
            <ul className="scrollbar-slim mt-2 max-h-56 space-y-1 overflow-y-auto">
              {results.map((place) => (
                <li key={`${place.latitude},${place.longitude},${place.name}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        latitude: place.latitude,
                        longitude: place.longitude,
                        name: describe(place),
                        source: "search",
                      });
                      setOpen(false);
                      setQuery("");
                    }}
                    className="text-ink-2 hover:bg-surface-2 hover:text-ink text-caption w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-150"
                  >
                    {describe(place)}
                  </button>
                </li>
              ))}
            </ul>
          ) : searched && !searching ? (
            <p className="text-ink-3 text-caption mt-2">{copy.noResults}</p>
          ) : null}

          {location ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="border-line text-ink-2 hover:bg-surface-2 hover:text-ink text-caption mt-3 w-full rounded-lg border px-3 py-1.5 transition-colors duration-150"
            >
              {copy.clearLocation}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
