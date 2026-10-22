import { Orb } from "@/components/ui/effects/orb";
import { AskAiButton } from "./ask-ai-button";

/**
 * Beside the results: the assistant, with its face, offered the same query. It answers from the
 * pages the reader may see and cites them, so it is the next step when no single row is the answer.
 */
export function AskCard({ query, aiEnabled = true }: { query: string; aiEnabled?: boolean }) {
  if (!aiEnabled) return null;
  return (
    <aside aria-label="Ask the assistant" className="panel relative isolate flex flex-col items-start gap-4 overflow-hidden rounded-panel p-5">
      <Orb size={52} className="relative" />
      <div className="relative flex flex-col gap-1">
        <p className="text-body-lg font-medium text-fg">Ask about &ldquo;{query}&rdquo;</p>
        <p className="text-small text-muted">One answer from the pages you can read, with the sources linked.</p>
      </div>
      <AskAiButton query={query} variant="secondary" className="relative" />
    </aside>
  );
}
