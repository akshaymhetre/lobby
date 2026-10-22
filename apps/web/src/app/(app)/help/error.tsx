"use client";

import { HelpdeskError } from "@/components/helpdesk/route-states";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return <HelpdeskError what="Help" reset={reset} back={{ href: "/", label: "Go home" }} />;
}
