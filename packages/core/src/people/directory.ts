import { and, eq, s } from "@lobby/db";

/**
 * Who is in the directory: active people with a profile. Never deactivated people and never the
 * break-glass admin account. The one filter behind the directory, its facets and the canonical
 * "People" count (counts.ts directoryPeopleCount).
 */
export const directoryPersonWhere = () => and(eq(s.users.status, "active"), eq(s.users.isBreakGlass, false))!;
