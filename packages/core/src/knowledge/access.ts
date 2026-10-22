/**
 * Who may see and edit knowledge. One set of rules, used by listings, page views, the editor,
 * server actions and the search indexer, so a page is never visible in one place and hidden in another.
 */
import type { UserContext } from "../identity/context";

export interface SpaceAccess {
  visibilityGroupIds: string[];
  editorGroupIds: string[];
}
export interface PageAccess {
  visibilityGroupIds: string[];
  ownerId?: string | null;
}

/**
 * The groups that may read a page. `null` means everyone. An empty array means nobody
 * (a restricted page inside a restricted space whose groups do not overlap).
 */
export function effectiveAudience(space: SpaceAccess, page?: PageAccess | null): string[] | null {
  const sg = space.visibilityGroupIds ?? [];
  const pg = page?.visibilityGroupIds ?? [];
  if (!sg.length && !pg.length) return null;
  if (!pg.length) return sg;
  if (!sg.length) return pg;
  return pg.filter((g) => sg.includes(g));
}

type Viewer = Pick<UserContext, "groupIds">;

export function canViewSpace(ctx: Viewer, space: SpaceAccess): boolean {
  const sg = space.visibilityGroupIds ?? [];
  return sg.length === 0 || sg.some((g) => ctx.groupIds.includes(g));
}

export function canViewPage(ctx: Viewer, space: SpaceAccess, page: PageAccess): boolean {
  if (!canViewSpace(ctx, space)) return false;
  const audience = effectiveAudience(space, page);
  return audience === null || audience.some((g) => ctx.groupIds.includes(g));
}

/** Content editors, admins and members of the space's editor groups, provided they can see the space. */
export function canEditSpace(ctx: Pick<UserContext, "groupIds" | "has">, space: SpaceAccess): boolean {
  if (!canViewSpace(ctx, space)) return false;
  if (ctx.has("admin") || ctx.has("content-editor")) return true;
  return (space.editorGroupIds ?? []).some((g) => ctx.groupIds.includes(g));
}

/** Owners may re-verify their own page even when they cannot edit the space. */
export function canReviewPage(ctx: Pick<UserContext, "groupIds" | "has" | "user">, space: SpaceAccess, page: PageAccess): boolean {
  if (!canViewPage(ctx, space, page)) return false;
  return page.ownerId === ctx.user.id || canEditSpace(ctx, space);
}

/** Search ACL principals for a page, or null when nobody may read it (do not index). */
export function pageAclPrincipals(space: SpaceAccess, page: PageAccess): string[] | null {
  const audience = effectiveAudience(space, page);
  if (audience === null) return ["*"];
  if (!audience.length) return null;
  return audience.map((g) => `group:${g}`);
}
