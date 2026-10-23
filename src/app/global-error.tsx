"use client";

import { useEffect } from "react";

/**
 * Last resort when the root layout itself fails. It replaces the whole
 * document, so global CSS isn't loaded: styles are inline and follow the OS theme.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[mso-pm] fatal error", error.digest ?? "", error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", colorScheme: "light dark", background: "Canvas", color: "CanvasText" }}>
        <title>Something went wrong · mso-pm</title>
        <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 16, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ margin: 0, maxWidth: 380, lineHeight: 1.5, opacity: 0.75 }}>mso-pm couldn’t load. Try again in a moment.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={retry} style={{ height: 40, padding: "0 16px", border: 0, borderRadius: 8, background: "#2d55c8", color: "#fff", font: "inherit", fontWeight: 500, cursor: "pointer" }}>
              Try again
            </button>
            {/* A full page load on purpose: the app's router may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/app" style={{ height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid #d6d5d0", color: "inherit", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Go to your dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
