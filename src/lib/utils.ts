import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "Meera Krishnan" → "MK"; a single-word name gives a single letter.
 *
 * Lived in `bookings.ts` until three screens wanted it (guests, settings, and
 * the team roster). Every avatar in the console spells its initials with this,
 * so a badge cannot disagree with the name printed next to it.
 */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
