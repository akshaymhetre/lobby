"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, MessageSquare } from "lucide-react";
import { toggleLikeAction, toggleSaveAction } from "@/app/(app)/(home)/_actions";
import { ReactionButton } from "@/components/ui/reaction";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const btn = {
  md: "h-8 px-2 text-small [&_svg]:size-4",
  sm: "h-7 px-1.5 text-caption [&_svg]:size-3.5",
} as const;
const base =
  "focus-ring touch-target inline-flex items-center gap-1.5 rounded-control font-medium text-muted " +
  "transition-[background-color,color,transform] duration-120 ease-standard hover:bg-hover hover:text-fg active:scale-[0.97] [&_svg]:stroke-[1.75]";

/**
 * Like, comment and save controls under a post. Optimistic, rolled back on error.
 * The like is a ReactionButton (the muted clay `reaction` tone), never danger red and never the accent.
 */
export function PostActions({
  postId,
  title,
  likeCount,
  liked,
  commentCount,
  saved,
  commentsHref,
  onSavedChange,
  size = "md",
  className,
}: {
  postId: string;
  title: string;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  saved: boolean;
  /** When set, the comment button links there; otherwise it is a plain count. */
  commentsHref?: string;
  onSavedChange?: (saved: boolean) => void;
  /** "sm" fits a feed row's meta line; "md" sits under a lead post or an article. */
  size?: "sm" | "md";
  className?: string;
}) {
  const [like, setLike] = React.useState({ liked, count: likeCount });
  const [isSaved, setSaved] = React.useState(saved);
  React.useEffect(() => setLike({ liked, count: likeCount }), [liked, likeCount]);
  React.useEffect(() => setSaved(saved), [saved]);

  const toggleLike = async () => {
    const prev = like;
    setLike({ liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) });
    const res = await toggleLikeAction(postId);
    if (!res.ok) {
      setLike(prev);
      toast.error(res.error);
    } else setLike({ liked: res.liked, count: res.count });
  };

  const toggleSave = async () => {
    const prev = isSaved;
    setSaved(!prev);
    const res = await toggleSaveAction(postId);
    if (!res.ok) {
      setSaved(prev);
      toast.error(res.error);
      return;
    }
    onSavedChange?.(res.saved);
    toast(res.saved ? "Saved for later" : "Removed from saved", {
      description: res.saved ? "Find it under Saved in the news feed." : undefined,
    });
  };

  const cls = cn(base, btn[size]);
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <ReactionButton
        pressed={like.liked}
        count={like.count}
        size={size}
        label={`${like.liked ? "Unlike" : "Like"} "${title}"`}
        onClick={toggleLike}
      />
      {commentsHref ? (
        <Link href={commentsHref} className={cls} aria-label={`${commentCount} comments on "${title}"`}>
          <MessageSquare aria-hidden />
          <span className="tabular">{commentCount}</span>
        </Link>
      ) : (
        <span className={cn(cls, "hover:bg-transparent hover:text-muted")} aria-label={`${commentCount} comments`}>
          <MessageSquare aria-hidden />
          <span className="tabular">{commentCount}</span>
        </span>
      )}
      <button
        type="button"
        className={cn(cls, "ml-auto", isSaved && "text-fg")}
        aria-pressed={isSaved}
        aria-label={isSaved ? `Remove "${title}" from saved` : `Save "${title}" for later`}
        onClick={toggleSave}
      >
        <Bookmark className={cn(isSaved && "fill-current")} aria-hidden />
        <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
      </button>
    </div>
  );
}
