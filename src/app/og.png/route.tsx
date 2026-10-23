import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

// The preview card shown when a link to the site is shared (WhatsApp, Slack, X, LinkedIn…).
// Served at /og.png: the extension keeps it outside the sign-in proxy, so crawlers can fetch it.

const size = { width: 1200, height: 630 };
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#000000", color: "#ededed" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#2d55c8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, paddingBottom: 6 }}>m</div>
          <div style={{ fontSize: 40 }}>mso-pm</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>Free project management for software teams</div>
          <div style={{ fontSize: 30, color: "#a1a1a1" }}>Boards, tasks, issues, releases, clients, docs and team chat.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#8f8f8f" }}>{new URL(SITE_URL).host}</div>
      </div>
    ),
    size,
  );
}
