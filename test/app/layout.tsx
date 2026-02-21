import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ⚠️ VULNERABILITY: No CSP, version disclosure, insecure metadata
export const metadata: Metadata = {
  title: "VulnApp v1.0.0 — Next.js 16",  // VULN-078: version in title
  description: "Running on Node.js 20, Next.js 16, PostgreSQL 14", // VULN-078: tech stack leak
  // No X-Frame-Options equivalent — clickjacking possible
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* VULN-103: Third-party script loaded without SRI (integrity check) */}
        {/* An attacker who compromises the CDN can execute arbitrary JS */}
        <script
          src="https://cdn.jsdelivr.net/npm/some-analytics@latest/dist/analytics.min.js"
          // Missing: integrity="sha256-..." crossOrigin="anonymous"
        />
        {/* VULN-079: No Content-Security-Policy meta tag */}
        {/* VULN-104: Referrer policy leaks full URL to third parties */}
        <meta name="referrer" content="unsafe-url" />
        {/* VULN-105: HSTS not set */}
        {/* VULN-106: X-Frame-Options not set → Clickjacking */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950`}
      >
        {/* VULN-107: No CSRF token injected into global state */}
        {children}
      </body>
    </html>
  );
}
