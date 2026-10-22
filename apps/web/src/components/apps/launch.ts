"use client";

import type { LaunchType } from "@lobby/core/apps/presets";
import { toast } from "@/components/ui/toast";

export const launchHref = (slug: string) => `/apps/launch/${encodeURIComponent(slug)}`;

const DESCRIPTION: Record<LaunchType, string> = {
  sso_link: "You are already signed in.",
  idp_initiated: "Signing you in through your company account.",
  bookmark: "This app has its own sign-in.",
};

/** The "opening with SSO" toast shown as a tile opens in a new tab. */
export function announceLaunch(app: { name: string; launchType: LaunchType }) {
  toast(`Opening ${app.name}`, { description: DESCRIPTION[app.launchType], duration: 3500 });
}

export const LAUNCH_CHIP: Record<LaunchType, { label: string; title: string } | null> = {
  sso_link: { label: "SSO", title: "Signs you in with your company account" },
  idp_initiated: { label: "IdP sign-in", title: "Signs you in through your identity provider" },
  bookmark: null,
};
