import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages may be indexed; the signed-in app and its routes are private.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/signup", "/login"],
      disallow: ["/app", "/account", "/admin", "/feedback", "/onboarding", "/invite", "/auth", "/api", "/verify", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
