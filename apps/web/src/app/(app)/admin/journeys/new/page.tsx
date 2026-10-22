import { builderOptions, journeyClock } from "@lobby/core/journeys";
import { addDays, isoWeekday } from "@lobby/core/journeys/dates";
import { Page } from "@/components/page";
import { JourneyBuilder } from "@/components/journeys/admin/journey-builder";
import { requireJourneyManager } from "@/server/auth";

export const metadata = { title: "New journey · Admin" };

export default async function NewJourneyPage() {
  const ctx = await requireJourneyManager();
  const [options, clock] = await Promise.all([builderOptions(ctx), journeyClock()]);
  const wd = isoWeekday(clock.today);
  const monday = addDays(clock.today, wd === 1 ? 7 : 8 - wd);
  return (
    <Page width="full">
      <JourneyBuilder
        initial={{ id: null, name: "", description: "", kind: "onboarding", active: true, conditions: {}, steps: [], activeRuns: 0 }}
        options={options}
        workingDays={clock.workingDays}
        defaultPreviewDate={monday}
      />
    </Page>
  );
}
