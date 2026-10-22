import { db, eq, s } from "@lobby/db";

export type OrgSettings = typeof s.orgSettings.$inferSelect;

/** Reads the single settings row, creating it on first use. */
export async function getOrgSettings(): Promise<OrgSettings> {
  const row = await db.query.orgSettings.findFirst({ where: eq(s.orgSettings.id, 1) });
  if (row) return row;
  const [created] = await db.insert(s.orgSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.query.orgSettings.findFirst({ where: eq(s.orgSettings.id, 1) }))!;
}

export async function updateOrgSettings(patch: Partial<Omit<OrgSettings, "id">>): Promise<OrgSettings> {
  await getOrgSettings();
  const [row] = await db.update(s.orgSettings).set(patch).where(eq(s.orgSettings.id, 1)).returning();
  return row!;
}

export const SETUP_STEPS = ["admin", "company", "identity", "people", "apps", "content"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export async function markSetupStep(step: SetupStep, status: "done" | "skipped") {
  const org = await getOrgSettings();
  const setupSteps = { ...org.setupSteps, [step]: { status, at: new Date().toISOString() } };
  const complete = SETUP_STEPS.every((k) => setupSteps[k]);
  return updateOrgSettings({ setupSteps, setupCompletedAt: complete ? (org.setupCompletedAt ?? new Date()) : null });
}
