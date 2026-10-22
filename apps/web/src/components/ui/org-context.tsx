"use client";

import * as React from "react";

export { formatDateline } from "./dateline";

/**
 * Org facts the shell already loads once per request, exposed to any component without a second fetch.
 * `(app)/layout.tsx` renders <OrgProvider> around the shell; the Masthead reads the company name
 * and the dateline from here, so no page has to pass them.
 *
 * The dateline is a string computed on the server (in the viewer's timezone) rather than a Date, so
 * the server and client render the same text and there is nothing to hydrate differently at midnight.
 */
export interface OrgContextValue {
  companyName: string;
  productName: string;
  /** IANA timezone the dateline was computed in (the viewer's, falling back to the org's). */
  timezone: string;
  /** "Thursday 15 October", computed by formatDateline on the server. */
  dateline: string;
}

const OrgContext = React.createContext<OrgContextValue | null>(null);

export function OrgProvider({ value, children }: { value: OrgContextValue; children: React.ReactNode }) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

/** Null outside the app shell (sign-in, setup, kitchen sink without a provider). */
export function useOrg(): OrgContextValue | null {
  return React.useContext(OrgContext);
}
