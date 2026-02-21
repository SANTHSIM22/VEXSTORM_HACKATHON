import type { NextConfig } from "next";

// ⚠️ VULNERABILITY: Insecure Next.js configuration
// VULN-077: dangerouslyAllowSVG without contentDispositionType — XSS via SVG
// VULN-078: X-Powered-By header exposes framework version
// VULN-079: No Content Security Policy headers
// VULN-080: All hostnames allowed for image source (open image proxy)
// VULN-081: Invalid CORS — wildcard origin on API routes

const nextConfig: NextConfig = {
  // VULN-078: Framework fingerprinting enabled
  poweredByHeader: true,

  // VULN-079: No security headers set
  // Missing: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, CSP

  images: {
    // VULN-077: SVG allowed without safe content type header
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline", // should be "attachment"
    // VULN-080: Any hostname allowed as image source
    remotePatterns: [
      { protocol: "https", hostname: "**" }, // ⚠️ wildcard
      { protocol: "http",  hostname: "**" }, // ⚠️ insecure HTTP allowed
    ],
  },

  // VULN-082: Source maps exposed in production build
  productionBrowserSourceMaps: true,

  // VULN-083: No output file tracing restrictions — full source in bundle
  experimental: {
    // VULN-084: Server Actions with no CSRF validation (pre-Next 14 style)
  },

  // VULN-081: CORS headers — wildcard allows any origin
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: "*" },       // ⚠️ wildcard CORS
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
          // Missing security headers:
          // X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP
        ],
      },
    ];
  },

  // VULN-063: Insecure redirects — all domains trusted
  async redirects() {
    return [
      // VULN-085: Internal path disclosure through redirect
      {
        source: "/old-admin",
        destination: "/admin",
        permanent: true,    // ⚠️ leaks that /admin exists
      },
    ];
  },
};

export default nextConfig;
