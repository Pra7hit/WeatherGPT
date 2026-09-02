"use client";

import { useEffect, useRef, useState } from "react";

import { useGeolocation } from "@/hooks/useGeolocation";
import type { ClientLocation, Language } from "@/lib/types";
import { t } from "@/lib/uiText";
import type { Place } from "@/services/weather/types";

import { CloseIcon, MeterIcon, PinIcon, SearchIcon } from "./icons";

/**
 * The STATION switch and its panel.
 *
 * This only sets a *default* for questions that name no place — a question that
 * says "Mumbai" always wins. Geolocation is requested on the button press only,
 * and city search goes through /api/geocode so the upstream call stays on the
 * server.
 *
 * The panel is a plate bolted under the head rule: 2px ink border, no rounding,
 * no shadow, and every row a hairline rule that inverts under the pointer. A
 * fixed station prints its coordinates, because that pair of numbers is what the
 * forecast is actually fetched for.
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
        data-on={open ? "true" : undefined}
        className="switch w-full min-w-0 sm:w-auto sm:max-w-[14rem]"
      >
        <PinIcon className="h-3.5 w-3.5 shrink-0" />
        {/* Unset reads "STATION —", not "STATION": the em-dash is how every empty
            value in this product is printed, so the control shows its state
            instead of just naming itself. */}
        <span className="truncate">{label ?? `${copy.station} —`}</span>
      </button>

      {open ? (
        <div className="border-ink bg-ground absolute right-0 z-30 mt-1 w-[19.5rem] max-w-[calc(100vw-1.5rem)] border-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="mono-label">{copy.location}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={copy.close}
              title={copy.close}
              className="hover:bg-ink hover:text-ground -m-1 p-1 transition-colors duration-100"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {location ? (
            /* LAT / LON is a unit symbol, not chrome prose — it stays in Latin in
               both languages, the way °C and mm do. */
            <p className="border-hair mt-2 flex items-baseline gap-2 border-t pt-2">
              <span className="mono-label shrink-0">LAT / LON</span>
              <span aria-hidden="true" className="leader" />
              <span className="numeric text-caption">
                {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
              </span>
            </p>
          ) : null}

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
            className="switch mt-3 w-full justify-start"
          >
            {geo.status === "locating" ? (
              <MeterIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <PinIcon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">
              {geo.status === "locating" ? copy.locating : copy.useMyLocation}
            </span>
          </button>

          {geo.error ? <p className="numeric text-caption mt-2">{geo.error}</p> : null}

          <div className="border-hair-3 focus-within:border-ink mt-3 flex items-center gap-2 border px-2 py-1.5 transition-colors duration-100">
            <SearchIcon className="h-3.5 w-3.5 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              /* The prompt is the machine's, so it is set in the mono at full
                 ink; the place name the user types arrives in the sans. Nothing
                 here thins ink to suggest emptiness. */
              className="text-caption prompt-hint w-full min-w-0 bg-transparent outline-none"
            />
            {searching ? <MeterIcon className="h-3.5 w-3.5 shrink-0" /> : null}
          </div>

          {results.length > 0 ? (
            <ul className="scrollbar-hair mt-2 max-h-56 overflow-y-auto">
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
                    className="border-hair hover:bg-ink hover:text-ground text-caption flex w-full items-baseline gap-2 border-t px-1 py-2 text-left transition-colors duration-100"
                  >
                    <span className="min-w-0 flex-1">{describe(place)}</span>
                    <span className="mono-label shrink-0">
                      {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : searched && !searching ? (
            <p className="mono-label mt-3">{copy.noResults}</p>
          ) : null}

          {location ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="switch mt-3 w-full"
            >
              {copy.clearLocation}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
