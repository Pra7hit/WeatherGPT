import path from "node:path";

import type { NextConfig } from "next";

/**
 * Response headers applied to every route.
 *
 * `Permissions-Policy` is the one to be careful with: voice input and "use my
 * location" both need their features on this origin, so both are granted to
 * `self` explicitly and everything else is denied. Dropping `microphone` from
 * this list would silently break the mic.
 *
 * There is deliberately no Content-Security-Policy here. `layout.tsx` sets the
 * theme with an inline script before first paint, so a useful CSP needs a
 * per-request nonce, which needs middleware, which would make the home page
 * dynamic. That trade is worth taking before this is a public product, and not
 * worth faking with `unsafe-inline` in the meantime.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
  // Only meaningful over TLS, which every deployed environment terminates.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up to C:\Users\prath, finds a stray
  // package-lock.json there and warns that it would treat the home directory as
  // the project root. Pinning the root keeps the build output clean.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
