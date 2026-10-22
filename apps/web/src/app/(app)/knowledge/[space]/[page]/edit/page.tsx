import { forbidden, notFound } from "next/navigation";
import { getPageBySlug } from "@lobby/core/knowledge";
import { asDoc } from "@lobby/core/knowledge/doc";
import { PageEditor } from "@/components/knowledge/editor/page-editor";
import { requireUser } from "@/server/auth";
import { loadEditorOptions } from "../../../_editor-data";

type Params = { params: Promise<{ space: string; page: string }> };

export async function generateMetadata({ params }: Params) {
  const ctx = await requireUser();
  const { space, page } = await params;
  const d = await getPageBySlug(ctx, space, page);
  return { title: d ? `Editing ${d.page.title}` : "Not found" };
}

export default async function EditPage({ params }: Params) {
  const ctx = await requireUser();
  const { space, page: slug } = await params;
  const d = await getPageBySlug(ctx, space, slug);
  if (!d) notFound();
  if (!d.canEdit) forbidden();
  const opts = await loadEditorOptions(ctx);
  const { page } = d;
  return (
    <PageEditor
      mode="edit"
      page={{
        id: page.id,
        title: page.title,
        content: asDoc(page.content),
        template: page.template,
        spaceId: page.spaceId,
        parentId: page.parentId,
        ownerId: page.ownerId,
        reviewBy: page.reviewBy,
        verifiedOn: page.verifiedAt ? page.verifiedAt.toISOString().slice(0, 10) : null,
        visibilityGroupIds: page.visibilityGroupIds,
        status: page.status,
      }}
      spaces={opts.spaces}
      people={opts.people}
      groups={opts.groups}
      today={opts.today}
      cancelHref={`/knowledge/${d.space.slug}/${page.slug}`}
    />
  );
}
