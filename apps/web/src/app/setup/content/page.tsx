import { db, sql } from "@lobby/db";
import { StepHeader } from "@/components/setup/step-header";
import { Shelves } from "@/components/setup/step-visuals";
import { StepFooter } from "@/components/setup/step-nav";
import { ContentPicker } from "@/components/setup/content-picker";
import { guardSetup } from "../_guard";

export const metadata = { title: "Starter content" };

async function count(table: "spaces" | "request_types" | "journeys") {
  try {
    const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)}`);
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export default async function ContentStep() {
  await guardSetup("content");
  const [spaces, requestTypes, journeys] = await Promise.all([count("spaces"), count("request_types"), count("journeys")]);
  return (
    <StepHeader step="content" aside={<Shelves knowledge={spaces} helpdesk={requestTypes} journeys={journeys} />}>
      <ContentPicker existing={{ knowledge: spaces, helpdesk: requestTypes, journeys }} />
      <StepFooter step="content" continueLabel="Finish setup" />
    </StepHeader>
  );
}
