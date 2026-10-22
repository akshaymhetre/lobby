import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export interface DemoPerson {
  first: string;
  last: string;
  title: string;
  dept: string;
  loc: string;
  manager: string | null;
  tenureDays: number;
  groups: string[];
}

export const demoPeople = (): DemoPerson[] =>
  JSON.parse(readFileSync(join(here, "../../../../deploy/demo/people.json"), "utf8"));

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const usernameOf = (p: Pick<DemoPerson, "first" | "last">) => `${slug(p.first)}.${slug(p.last)}`;
export const emailOf = (p: Pick<DemoPerson, "first" | "last">) => `${usernameOf(p)}@northwind.example`;
export const DEMO_DOMAIN = "northwind.example";

/** Date string N days from today (negative = in the past). */
export function daysFromToday(n: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

/** Context handed to every module seeder. */
export interface SeedContext {
  userIdByUsername: Map<string, string>;
  groupIdByName: Map<string, string>;
  user: (username: string) => string;
  group: (name: string) => string;
}
