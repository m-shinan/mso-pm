import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

// PNG icons for the web app manifest, rendered once at build time.
const FILES: Record<string, { size: number; fullBleed: boolean }> = {
  "icon-192.png": { size: 192, fullBleed: false },
  "icon-512.png": { size: 512, fullBleed: false },
  "maskable-512.png": { size: 512, fullBleed: true },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const spec = FILES[(await params).file];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIcon size={spec.size} fullBleed={spec.fullBleed} />, { width: spec.size, height: spec.size });
}
