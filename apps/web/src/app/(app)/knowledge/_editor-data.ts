import "server-only";
import type { UserContext } from "@lobby/core";
import { editableSpaces, listGroups, listPeopleForOwner, listSpacePages, todayIso } from "@lobby/core/knowledge";
import type { EditorSpace } from "@/components/knowledge/editor/page-editor";

/** Everything the page editor needs to offer: spaces the user may write in, owners and groups. */
export async function loadEditorOptions(ctx: UserContext) {
  const spaces = await editableSpaces(ctx);
  const [pagesBySpace, people, groups] = await Promise.all([
    Promise.all(spaces.map((sp) => listSpacePages(ctx, sp))),
    listPeopleForOwner(),
    listGroups(),
  ]);
  const editorSpaces: EditorSpace[] = spaces.map((sp, i) => ({
    id: sp.id,
    slug: sp.slug,
    name: sp.name,
    restricted: sp.visibilityGroupIds.length > 0,
    pages: pagesBySpace[i]!.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, title: p.title })),
  }));
  return { spaces: editorSpaces, people, groups, today: todayIso() };
}
