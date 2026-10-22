"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Next scrolls to the changed segment on navigation, not to the top of the document, so moving
 * from one setup step to the next landed the reader about 90px down with the wizard's top bar
 * hidden. Every step is a new task, so start each one at the very top.
 */
export function ScrollToTopOnStep() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
