import { db, eq, s, sql } from "@lobby/db";
import { hashPassword } from "../crypto";
import { audit } from "../audit";
import { getOrgSettings, markSetupStep } from "../settings";
import { passwordStrength } from "./password";

export async function hasBreakGlassAdmin(): Promise<boolean> {
  const row = await db.query.users.findFirst({ where: eq(s.users.isBreakGlass, true), columns: { id: true } });
  return !!row;
}

export interface BreakGlassInput {
  name: string;
  email: string;
  password: string;
}

export type FieldErrors = Partial<Record<string, string>>;

export class ValidationError extends Error {
  constructor(public fieldErrors: FieldErrors, message = "Please check the highlighted fields.") {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates the one break-glass administrator. Refused once any break-glass admin exists, so the
 * public /setup page cannot be used to mint a second admin later.
 * The insert is guarded by an advisory lock so two tabs racing the wizard cannot both win.
 */
export async function createBreakGlassAdmin(input: BreakGlassInput): Promise<{ userId: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const errors: FieldErrors = {};
  if (!name) errors.name = "Enter your name.";
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  const org = await getOrgSettings();
  const strength = passwordStrength(input.password, [email.split("@")[0] ?? "", org.companyName]);
  if (!strength.acceptable) errors.password = strength.hint;
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const userId = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242001)`);
    const existing = await tx.query.users.findFirst({ where: eq(s.users.isBreakGlass, true), columns: { id: true } });
    if (existing) throw new ValidationError({}, "An administrator already exists. Sign in instead.");
    const passwordHash = await hashPassword(input.password);
    const [first, ...rest] = name.split(/\s+/);
    const byEmail = await tx.query.users.findFirst({ where: eq(s.users.email, email), columns: { id: true } });
    if (byEmail) {
      await tx
        .update(s.users)
        .set({ isBreakGlass: true, passwordHash, status: "active", displayName: name })
        .where(eq(s.users.id, byEmail.id));
      return byEmail.id;
    }
    const [row] = await tx
      .insert(s.users)
      .values({
        email,
        firstName: first ?? name,
        lastName: rest.join(" "),
        displayName: name,
        title: "Administrator",
        source: "local",
        isBreakGlass: true,
        passwordHash,
      })
      .returning({ id: s.users.id });
    return row!.id;
  });

  await audit(userId, "setup.admin_created", { type: "user", id: userId }, { email });
  await markSetupStep("admin", "done");
  return { userId };
}
