"use client";

// Which chat channel is open on screen right now, so a pop-up isn't shown for
// a message you're already reading.
let open: string | null = null;

export function setOpenChannel(id: string | null) {
  open = id;
}

export function isChannelOpen(id: string | null | undefined) {
  return Boolean(id) && open === id && typeof document !== "undefined" && !document.hidden;
}
