import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the tracing root to this project so a stray lockfile in a parent
  // directory doesn't confuse Next's workspace-root detection.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
