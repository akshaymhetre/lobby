/**
 * Optional links to the knowledge and helpdesk modules. They are built and installed
 * independently, so journeys load them lazily and degrade gracefully when they are absent.
 */
import type { UserContext } from "../identity/context";

/** getPageBySlug returns a page detail ({ page: { id } }); older shapes returned the row itself. */
export type KnowledgePageRef = { page: { id: string; title: string } } | { id: string; title: string };

export function pageIdOf(ref: KnowledgePageRef | null | undefined): string | null {
  if (!ref) return null;
  return "page" in ref ? ref.page.id : ref.id;
}

export interface KnowledgeModule {
  getPageBySlug: (ctx: UserContext, spaceSlug: string, pageSlug: string) => Promise<KnowledgePageRef | null | undefined>;
  acknowledgePage: (ctx: UserContext, pageId: string) => Promise<unknown>;
  hasAcknowledged: (userId: string, pageId: string) => Promise<boolean>;
}

export interface HelpdeskModule {
  createTicket: (
    ctx: UserContext,
    input: {
      requestTypeSlug: string;
      subject: string;
      description?: string;
      fields?: Record<string, unknown>;
      priority?: string;
      source?: string;
      onBehalfOfUserId?: string;
    },
  ) => Promise<{ id: string; number: number }>;
}

const warned = new Set<string>();

async function load<T>(name: "knowledge" | "helpdesk", required: (keyof T)[]): Promise<T | null> {
  try {
    const mod = (await import(`../${name}/index`)) as Record<string, unknown>;
    if (required.every((k) => typeof mod[k as string] === "function")) return mod as T;
  } catch {
    // Module not installed yet: fall through.
  }
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[journeys] the ${name} module is not available; continuing without it`);
  }
  return null;
}

export const loadKnowledge = () =>
  load<KnowledgeModule>("knowledge", ["getPageBySlug", "acknowledgePage", "hasAcknowledged"]);

export const loadHelpdesk = () => load<HelpdeskModule>("helpdesk", ["createTicket"]);
