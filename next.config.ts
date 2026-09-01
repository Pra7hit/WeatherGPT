import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up to C:\Users\prath, finds a stray
  // package-lock.json there and warns that it would treat the home directory as
  // the project root. Pinning the root keeps the build output clean.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
