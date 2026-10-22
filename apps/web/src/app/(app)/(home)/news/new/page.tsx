import { forbidden } from "next/navigation";
import { canAuthorPosts } from "@lobby/core/home";
import { Page } from "@/components/page";
import { PostEditor } from "@/components/home/post-editor";
import { requireUser } from "@/server/auth";
import { loadEditorOptions } from "../_load";

export const metadata = { title: "New post" };

export default async function NewPostPage() {
  const ctx = await requireUser();
  if (!canAuthorPosts(ctx)) forbidden();
  const { groups, categories } = await loadEditorOptions();
  return (
    <Page width="wide">
      <PostEditor
        groups={groups}
        categories={categories}
        initial={{ title: "", summary: "", category: "Company", coverImageUrl: "", bodyHtml: "", audienceGroupIds: [], pinned: false, published: false }}
      />
    </Page>
  );
}
