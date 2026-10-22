import { redirect } from "next/navigation";
import { getOrgSettings } from "@lobby/core";
import { hasBreakGlassAdmin } from "@lobby/core/admin";
import { STEPS } from "@/components/setup/steps";

/** Sends you to the first step that is neither done nor skipped. */
export default async function SetupIndex() {
  if (!(await hasBreakGlassAdmin())) redirect("/setup/admin");
  const org = await getOrgSettings();
  const next = STEPS.find((s) => !org.setupSteps[s.key]);
  redirect(next ? `/setup/${next.key}` : "/setup/done");
}
