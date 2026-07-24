// Shared room-type → photo mapping, so the homepage and every landmark page
// show the same picture for the same room type instead of each hand-copying
// its own — same single-source-of-truth reasoning as `seo.ts`'s NAP facts.

import hero from "@/assets/hero.jpg";
import roomBalcony from "@/assets/room-balcony.jpg";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import type { RoomType } from "@/types/booking";

// Partial, not the exhaustive `Record<RoomType, string>`: a room type added to
// the union later (or an admin-configured type this map doesn't know about)
// falls back to `DEFAULT_ROOM_IMAGE` rather than losing its image.
export const ROOM_IMAGES: Partial<Record<RoomType, string>> = {
  deluxe: roomDeluxe,
  deluxe_balcony: roomBalcony,
};

export const DEFAULT_ROOM_IMAGE = hero;
