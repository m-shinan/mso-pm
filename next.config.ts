import type { NextConfig } from "next";

// Applied to every response. No full CSP yet: Next's inline scripts would need nonces.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Revisiting a page within 30s renders instantly from the client cache instead of
  // waiting on the server. router.refresh() after a mutation, and LiveRefresh, still
  // fetch fresh data.
  experimental: { staleTimes: { dynamic: 30 } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Always fetch the newest service worker.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
