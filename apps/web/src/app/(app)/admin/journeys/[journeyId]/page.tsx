import { notFound } from "next/navigation";
import { builderOptions, getJourneyForEdit, journeyClock } from "@lobby/core/journeys";
import { addDays, isoWeekday } from "@lobby/core/journeys/dates";
import { Page } from "@/components/page";
import { JourneyBuilder } from "@/components/journeys/admin/journey-builder";
import { requireJourneyManager } from "@/server/auth";

export const metadata = { title: "Edit journey · Admin" };

/** The next Monday after today, a typical start date for the preview. */
function nextMonday(today: string) {
  const wd = isoWeekday(today);
  return addDays(today, wd === 1 ? 7 : 8 - wd);
}

export default async function EditJourneyPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const ctx = await requireJourneyManager();
  const { journeyId } = await params;
  const [journey, options, clock] = await Promise.all([getJourneyForEdit(ctx, journeyId), builderOptions(ctx), journeyClock()]);
  if (!journey) notFound();
  return (
    <Page width="full">
      <JourneyBuilder key={journey.id} initial={journey} options={options} workingDays={clock.workingDays} defaultPreviewDate={nextMonday(clock.today)} />
    </Page>
  );
}
