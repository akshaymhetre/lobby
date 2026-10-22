import { forbidden, notFound } from "next/navigation";
import { canAuthorPosts, getPostForEdit } from "@lobby/core/home";
import { Page } from "@/components/page";
import { PostEditor } from "@/components/home/post-editor";
import { requireUser } from "@/server/auth";
import { loadEditorOptions } from "../../_load";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  if (!canAuthorPosts(ctx)) forbidden();
  const post = await getPostForEdit(ctx, (await params).id);
  if (!post) notFound();
  const { groups, categories } = await loadEditorOptions();
  return (
    <Page width="wide">
      <PostEditor
        groups={groups}
        categories={categories}
        initial={{
          id: post.id,
          title: post.title,
          summary: post.summary ?? "",
          category: post.category,
          coverImageUrl: post.coverImageUrl ?? "",
          bodyHtml: post.body,
          audienceGroupIds: post.audienceGroupIds,
          pinned: post.pinned,
          published: !!post.publishedAt,
        }}
      />
    </Page>
  );
}
