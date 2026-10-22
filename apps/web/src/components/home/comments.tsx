"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Trash2 } from "lucide-react";
import { addCommentAction, deleteCommentAction } from "@/app/(app)/(home)/_actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatDateTime, timeAgo } from "@/lib/time";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; title: string | null; avatarUrl: string | null };
  canDelete: boolean;
}

export function Comments({
  postId,
  comments,
  me,
}: {
  postId: string;
  comments: CommentItem[];
  me: { id?: string; name: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addCommentAction(postId, body);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  };

  const remove = async (id: string) => {
    setDeleting(id);
    const res = await deleteCommentAction(id, postId);
    setDeleting(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast("Comment deleted");
      router.refresh();
    }
  };

  return (
    <section id="comments" aria-labelledby="comments-heading" className="flex scroll-mt-20 flex-col gap-4">
      <h2 id="comments-heading" className="text-h4 font-medium text-fg">
        {comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : "Comments"}
      </h2>

      {comments.length ? (
        <ol className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} id={`comment-${c.id}`} className="group flex scroll-mt-20 gap-3">
              <Avatar name={c.author.name} src={c.author.avatarUrl} seed={c.author.id} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-small font-medium text-fg">{c.author.name}</span>
                  <time className="text-caption text-muted" dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>
                    {timeAgo(c.createdAt)}
                  </time>
                  {c.canDelete ? (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      disabled={deleting === c.id}
                      className="focus-ring touch-target -my-1.5 ml-auto inline-flex size-7 items-center justify-center rounded-control text-subtle transition-[opacity,color,background-color] duration-120 hover:bg-hover hover:text-danger-text md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      aria-label={`Delete comment by ${c.author.name}`}
                    >
                      <Trash2 className="size-3.5 stroke-[1.5]" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <p className="whitespace-pre-line text-body text-fg text-pretty">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="flex items-center gap-2 text-body text-muted">
          <MessageSquare className="size-4 stroke-[1.5]" aria-hidden />
          No comments yet. Start the conversation.
        </p>
      )}

      <form onSubmit={submit} className="flex gap-3 pt-2">
        <Avatar name={me.name} src={me.avatarUrl} seed={me.id} />
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="new-comment" className="sr-only">
            Add a comment
          </label>
          <Textarea
            id="new-comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Add a comment"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "comment-error" : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {error ? (
            <p id="comment-error" className="text-small text-danger-text">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-3">
            <span className="hidden text-caption text-subtle sm:inline">Cmd or Ctrl and Enter to post</span>
            <Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>
              Post comment
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
