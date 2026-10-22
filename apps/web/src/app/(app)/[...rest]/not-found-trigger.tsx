"use client";

import { notFound } from "next/navigation";

/** Throws the not-found signal from the client tree (see page.tsx for why not from the server one). */
export function NotFoundTrigger(): never {
  notFound();
}
