import Link from "next/link";
import { FileLock2 } from "lucide-react";
import type { PageTemplate } from "@lobby/core/knowledge/templates";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageEditor } from "@/components/knowledge/editor/page-editor";
import { requireUser } from "@/server/auth";
import { loadEditorOptions } from "../_editor-data";

export const metadata = { title: "New page" };

const TEMPLATE_KEYS: PageTemplate[] = ["blank", "policy", "how-to", "team", "onboarding-guide"];

export default async function NewPage({ searchParams }: { searchParams: Promise<{ space?: string; parent?: string; template?: string }> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const opts = await loadEditorOptions(ctx);
  if (!opts.spaces.length) {
    return (
      <Page>
        <EmptyState
          className="mt-10"
          icon={<FileLock2 />}
          title="You cannot write pages yet"
          description="Editors of each space and content editors write pages. Ask the People or IT team if you should be one, or raise a ticket to suggest a page."
          action={
            <Button asChild>
              <Link href="/help/new">Suggest a page</Link>
            </Button>
          }
          secondary={
            <Button variant="secondary" asChild>
              <Link href="/knowledge">Back to Knowledge</Link>
            </Button>
          }
        />
      </Page>
    );
  }
  const space = opts.spaces.find((s) => s.slug === sp.space) ?? opts.spaces[0]!;
  const parent = space.pages.find((p) => p.id === sp.parent);
  const template = TEMPLATE_KEYS.includes(sp.template as PageTemplate) ? (sp.template as PageTemplate) : "blank";
  return (
    <PageEditor
      mode="new"
      page={{
        title: "",
        content: null,
        template,
        spaceId: space.id,
        parentId: parent?.id ?? null,
        ownerId: ctx.user.id,
        reviewBy: null,
        visibilityGroupIds: [],
        status: "draft",
      }}
      spaces={opts.spaces}
      people={opts.people}
      groups={opts.groups}
      today={opts.today}
      cancelHref={sp.space ? `/knowledge/${space.slug}` : "/knowledge"}
    />
  );
}
