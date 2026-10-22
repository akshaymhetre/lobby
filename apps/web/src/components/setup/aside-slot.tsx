"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ASIDE_SLOT } from "./aside-slot-id";

/**
 * Renders its children into the step's preview pane (StepHeader aside="slot"), so a client form can
 * show a preview that follows its own state beside it. Renders nothing until mounted, and nothing
 * when the step has no pane (phones hide the pane; give them an inline preview instead).
 */
export function AsideSlot({ children }: { children: React.ReactNode }) {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => setEl(document.getElementById(ASIDE_SLOT)), []);
  return el ? createPortal(children, el) : null;
}
