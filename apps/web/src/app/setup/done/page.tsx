import { asc, db, s as schema } from "@lobby/db";
import { getOrgSettings } from "@lobby/core";
import { adminHealth } from "@lobby/core/admin";
import { directoryPersonWhere, pageCounts } from "@lobby/core/counts";
import { DoneCelebration } from "@/components/setup/done-celebration";
import { STEPS } from "@/components/setup/steps";
import { guardSetup } from "../_guard";

export const metadata = { title: "All set" };

export default async function DoneStep() {
  const ctx = await guardSetup("done");
  const [org, health, pages, faces] = await Promise.all([
    getOrgSettings(),
    adminHealth(),
    ctx ? pageCounts(ctx).then((c) => c.published ?? 0) : 0,
    db
      .select({ id: schema.users.id, name: schema.users.displayName })
      .from(schema.users)
      .where(directoryPersonWhere())
      .orderBy(asc(schema.users.createdAt))
      .limit(7),
  ]);
  const skipped = STEPS.filter((s) => org.setupSteps[s.key]?.status !== "done");
  const status = Object.fromEntries(STEPS.map((s) => [s.key, org.setupSteps[s.key]?.status])) as Record<string, "done" | "skipped" | undefined>;
  const named = org.companyName !== "Your company";
  return (
    <DoneCelebration
      title={named ? `${org.productName} is ready for ${org.companyName}` : `${org.productName} is ready`}
      lead={
        skipped.length
          ? "Everything you skipped waits in Admin, so you can finish it when you have the details to hand."
          : "Send people the link. They sign in with the account they already have."
      }
      productName={org.productName}
      companyName={named ? org.companyName : org.productName}
      logoUrl={org.logoUrl ?? null}
      status={status}
      stats={{ people: health.people, apps: health.apps ?? 0, pages }}
      faces={faces}
    />
  );
}
