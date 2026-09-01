"use client";

import { useCallback, useState } from "react";

import type { ClientLocation } from "@/lib/types";

/**
 * Browser geolocation, resolved to a place name.
 *
 * Permission is only requested when the user presses the button - never on load.
 * The coordinates go to /api/reverse-geocode (server-side) purely to get a
 * display name; if that lookup fails the coordinates are still usable, so the
 * location is returned without a name rather than discarded.
 */

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "error";

interface State {
  status: GeoStatus;
  error?: string;
}

export function useGeolocation() {
  const [state, setState] = useState<State>({ status: "idle" });

  const request = useCallback(async (): Promise<ClientLocation | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", error: "This browser does not expose geolocation." });
      return null;
    }

    setState({ status: "locating" });

    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 300_000,
        });
      });
    } catch (error) {
      const denied =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as GeolocationPositionError).code === 1;
      setState({
        status: denied ? "denied" : "error",
        error: denied
          ? "Location permission was declined. You can still name a city instead."
          : "Could not read your location. You can still name a city instead.",
      });
      return null;
    }

    const latitude = Number(position.coords.latitude.toFixed(4));
    const longitude = Number(position.coords.longitude.toFixed(4));
    let name: string | undefined;

    try {
      const response = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
      if (response.ok) {
        const data = (await response.json()) as { place?: { name?: string; admin1?: string } };
        name = [data.place?.name, data.place?.admin1].filter(Boolean).join(", ") || undefined;
      }
    } catch {
      // Name is cosmetic; the coordinates are what the tools actually need.
    }

    setState({ status: "ready" });
    return { latitude, longitude, name, source: "geolocation" };
  }, []);

  return { ...state, request };
}
