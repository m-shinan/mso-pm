import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

// Browser tab and search-result icon (Google wants a square, a multiple of 48px).
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIcon size={192} />, size);
}
