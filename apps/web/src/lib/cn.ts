import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge must know Lobby's custom theme keys, or it treats `text-small`
 * as a colour and lets `text-fg` delete it (or the other way round).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "small", "body", "body-lg", "h4", "h3", "h2", "h1", "display"],
      radius: ["control", "card", "dialog"],
      shadow: ["lift", "popover", "dialog"],
      animate: [
        "fade-in",
        "fade-out",
        "pop-in",
        "pop-out",
        "dialog-in",
        "dialog-out",
        "sheet-in-right",
        "sheet-out-right",
        "sheet-in-left",
        "sheet-out-left",
        "sheet-in-bottom",
        "sheet-out-bottom",
        "shimmer",
        "spin-slow",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
