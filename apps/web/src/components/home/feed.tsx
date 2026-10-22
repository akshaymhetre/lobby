import Link from "next/link";
import { Bookmark, FilePen, Newspaper, Pin, Plus } from "lucide-react";
import type { FeedPost } from "@lobby/core/home";
import { Avatar } from "@/components/ui/avatar";
import { CategoryChip } from "@/components/ui/category-block";
import { SpotlightLayer } from "@/components/ui/effects/spotlight";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate, timeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { MoreOnPhone } from "./more-on-phone";
import { FILL, NewsCategoryPill, newsTone, storyFigures } from "./news-tone";
import { PostActions } from "./post-actions";

export function PostByline({ post, size = "md" }: { post: Pick<FeedPost, "author" | "publishedAt">; size?: "md" | "lg" }) {
  const name = post.author?.name ?? "Former colleague";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} src={post.author?.avatarUrl} size={size === "lg" ? "lg" : "md"} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-small font-medium text-fg">{name}</span>
        <span className="flex min-w-0 items-center gap-2 text-caption text-muted">
          {post.author?.title ? <span className="truncate">{post.author.title}</span> : null}
          <time dateTime={post.publishedAt.toISOString()} title={formatDate(post.publishedAt)} className="shrink-0 rounded-full bg-sunken px-2 py-0.5">
            {timeAgo(post.publishedAt)}
          </time>
        </span>
      </div>
    </div>
  );
}

/**
 * The lead story: a magazine cover. The top is the story's category gradient (or its cover image
 * under a dark scrim) with the headline set at the hero size in white; the bottom strip carries the
 * byline and the reactions. The whole cover is the link; the controls sit above it.
 */
export function PostCard({ post, className }: { post: FeedPost; className?: string }) {
  const href = `/news/${post.id}`;
  const { tone, icon: Icon } = newsTone(post.category);
  const onImage = !!post.coverImageUrl;
  // The number the story leads with ("Revenue up 31%"), set big on the cover in place of an ornament.
  const figure = storyFigures(post.summary ?? "", 1)[0];
  return (
    <article aria-labelledby={`post-${post.id}`} className={cn("cell group/lead relative isolate flex flex-col overflow-hidden rounded-panel", className)}>
      <div className={cn("relative isolate flex min-h-[280px] flex-1 flex-col justify-end gap-3 overflow-hidden p-5 sm:p-7", onImage ? "text-white" : FILL[tone])}>
        {onImage ? (
          <>
            {/* Cover images are uploaded by content editors; plain img keeps them simple. */}
            <img src={post.coverImageUrl!} alt="" className="absolute inset-0 -z-20 size-full object-cover" loading="lazy" />
            <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />
          </>
        ) : figure ? (
          <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_0%_100%,rgb(0_0_0/0.18),transparent_60%),radial-gradient(60%_80%_at_100%_0%,rgb(255_255_255/0.2),transparent_60%)]" />
        ) : (
          <>
            {/* The category's glyph, oversized and faint: the cover's only ornament. */}
            <Icon aria-hidden className="pointer-events-none absolute -right-6 -top-8 -z-10 size-56 stroke-[1.25] opacity-[0.16] transition-transform duration-500 ease-standard group-hover/lead:-rotate-6 motion-reduce:transition-none" />
            <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_0%_100%,rgb(0_0_0/0.18),transparent_60%)]" />
          </>
        )}
        {figure && !onImage ? (
          <p className="flex flex-col items-start sm:absolute sm:right-7 sm:top-6 sm:items-end sm:text-right">
            <span className="tabular text-[64px] font-medium leading-none tracking-[-0.04em] sm:text-[88px]">{figure.value}</span>
            <span className="mt-1 text-small opacity-85">{figure.label}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip tone={onImage ? undefined : tone}>{post.category}</CategoryChip>
          {post.pinned ? (
            <CategoryChip tone={onImage ? undefined : tone} className="gap-1.5">
              <Pin className="size-3.5 stroke-[2]" aria-hidden />
              Pinned
            </CategoryChip>
          ) : null}
        </div>
        <h3 id={`post-${post.id}`} className="max-w-[560px] text-h2 font-medium text-balance md:text-hero">
          <Link href={href} className="focus-ring rounded-[4px] after:absolute after:inset-0 after:content-['']">
            {post.title}
          </Link>
        </h3>
        {post.summary ? <p className="max-w-[640px] text-body-lg opacity-90 text-pretty">{post.summary}</p> : null}
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5 sm:px-7">
        <PostByline post={post} />
        <PostActions
          postId={post.id}
          title={post.title}
          likeCount={post.likeCount}
          liked={post.liked}
          commentCount={post.commentCount}
          saved={post.saved}
          commentsHref={`${href}#comments`}
          className="-mx-2"
        />
      </div>
    </article>
  );
}

/**
 * Every story after the lead: a raised tile with its category as a filled pill, the headline at
 * 18px, two lines of summary, and the author with the reactions. The tile is the link.
 */
export function PostTile({ post, wrapper = "li" }: { post: FeedPost; wrapper?: "li" | "div" }) {
  const href = `/news/${post.id}`;
  const name = post.author?.name ?? "Former colleague";
  const Wrapper = wrapper;
  return (
    <Wrapper className="min-w-0">
      <article
        aria-labelledby={`post-${post.id}`}
        className="cell relative isolate flex h-full flex-col gap-3 rounded-card p-4 transition-[transform,box-shadow] duration-160 ease-standard hover:-translate-y-0.5 hover:shadow-cell-hover motion-reduce:hover:translate-y-0 sm:p-5"
      >
        <SpotlightLayer />
        <div className="flex items-center justify-between gap-3">
          <NewsCategoryPill category={post.category} />
          <time dateTime={post.publishedAt.toISOString()} title={formatDate(post.publishedAt)} className="shrink-0 text-caption text-muted">
            {timeAgo(post.publishedAt)}
          </time>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 id={`post-${post.id}`} className="line-clamp-2 text-h4 font-medium text-fg text-balance">
            <Link href={href} className="focus-ring rounded-[3px] after:absolute after:inset-0 after:content-['']">
              {post.title}
            </Link>
          </h3>
          {post.summary ? <p className="line-clamp-2 text-body text-muted text-pretty">{post.summary}</p> : null}
        </div>
        <div className="relative z-10 mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={name} src={post.author?.avatarUrl} size="sm" />
            <span className="truncate text-small font-medium text-fg">{name}</span>
          </span>
          <PostActions
            postId={post.id}
            title={post.title}
            likeCount={post.likeCount}
            liked={post.liked}
            commentCount={post.commentCount}
            saved={post.saved}
            commentsHref={`${href}#comments`}
            size="sm"
            className="-mr-1.5"
          />
        </div>
      </article>
    </Wrapper>
  );
}

/**
 * A story in the dense list beside the tiles: its category as a filled square, the headline at
 * 15px on one line, and the author with the age. The whole row is the link.
 */
export function PostLine({ post }: { post: FeedPost }) {
  const href = `/news/${post.id}`;
  const name = post.author?.name ?? "Former colleague";
  const { tone, icon: Icon } = newsTone(post.category);
  return (
    <li className="min-w-0">
      <Link
        href={href}
        aria-label={`${post.title}, ${post.category}, by ${name}`}
        className="cell focus-ring press group/line flex min-h-[64px] items-center gap-3 rounded-cell p-2.5 pr-4 hover:shadow-cell-hover"
      >
        <span aria-hidden className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]", FILL[tone])}>
          <Icon className="size-5 stroke-[1.75]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-row font-medium text-fg">{post.title}</span>
          <span className="flex min-w-0 items-center gap-2 text-caption text-muted">
            <span className="truncate">{post.category}</span>
            <span aria-hidden className="size-1 shrink-0 rounded-full bg-border-strong" />
            <span className="truncate">{name}</span>
            <time dateTime={post.publishedAt.toISOString()} className="ml-auto shrink-0">
              {timeAgo(post.publishedAt)}
            </time>
          </span>
        </span>
      </Link>
    </li>
  );
}

export interface DraftItem {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  updatedAt: Date;
  authorName: string | null;
}

export function NewsFeed({
  posts,
  view,
  canAuthor = false,
  drafts = [],
}: {
  posts: FeedPost[];
  view: "latest" | "saved" | "drafts";
  canAuthor?: boolean;
  drafts?: DraftItem[];
}) {
  const tab = (key: "latest" | "saved" | "drafts", label: string, href: string) => (
    <Link
      href={href}
      scroll={false}
      aria-current={view === key ? "page" : undefined}
      className={cn(
        "focus-ring touch-target inline-flex h-7 items-center rounded-full px-3 text-small font-medium transition-colors duration-120",
        view === key ? "cell text-fg" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
  const lead = view === "latest" ? posts[0] : undefined;
  const rest = view === "latest" ? posts.slice(1) : posts;
  return (
    <section aria-labelledby="news-heading" className="flex scroll-mt-24 flex-col gap-4 rounded-panel panel p-5" id="news">
      <div className="flex items-center justify-between gap-3">
        <h2 id="news-heading" className="text-h3 font-medium text-fg md:text-h2">
          News
        </h2>
        <div className="flex items-center gap-2">
          <nav aria-label="News view" className="inline-flex items-center gap-0.5 rounded-full bg-sunken p-1">
            {tab("latest", "Latest", "/#news")}
            {tab("saved", "Saved", "/?view=saved#news")}
            {canAuthor ? tab("drafts", drafts.length ? `Drafts ${drafts.length}` : "Drafts", "/?view=drafts#news") : null}
          </nav>
          {canAuthor ? (
            <Button size="sm" asChild>
              <Link href="/news/new">
                <Plus aria-hidden />
                <span className="sr-only sm:not-sr-only">New post</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      {view === "drafts" ? (
        drafts.length ? (
          // Raised cells (not CellList: it holds a React context, and this is a server component).
          <ul className="flex flex-col gap-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/news/${d.id}/edit`}
                  className="cell focus-ring press flex min-h-[52px] items-center gap-3 rounded-cell px-3 py-2.5 hover:shadow-cell-hover"
                >
                  <NewsCategoryPill category={d.category} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-row font-medium text-fg">{d.title}</span>
                    <span className="flex flex-wrap items-center gap-x-3 text-caption text-muted">
                      <span>{d.authorName ?? "Unknown author"}</span>
                      <span>Edited {timeAgo(d.updatedAt)}</span>
                    </span>
                  </span>
                  <FilePen className="size-4 shrink-0 stroke-[1.5] text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="filtered"
            icon={<FilePen />}
            title="No drafts"
            description="Posts you save without publishing wait here until they are ready."
            action={
              <Button asChild>
                <Link href="/news/new">Write a post</Link>
              </Button>
            }
          />
        )
      ) : posts.length ? (
        // A front page, not a column: the lead cover takes half the width and both rows, two tiles sit
        // beside it, and the rest is a dense list under the tiles. Phones fold the list behind a button.
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {lead ? <PostCard post={lead} className="sm:col-span-2 lg:row-span-2" /> : null}
          {rest.slice(0, 2).map((p) => (
            <PostTile key={p.id} post={p} wrapper="div" />
          ))}
          {rest.length > 2 ? (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <MoreOnPhone count={rest.length - 2} noun={rest.length - 2 === 1 ? "story" : "stories"}>
                <ul className="flex flex-col gap-2" aria-label="More stories">
                  {rest.slice(2, 6).map((p) => (
                    <PostLine key={p.id} post={p} />
                  ))}
                </ul>
              </MoreOnPhone>
            </div>
          ) : null}
        </div>
      ) : view === "saved" ? (
        <EmptyState
          variant="filtered"
          icon={<Bookmark />}
          title="Nothing saved yet"
          description="Save a post to read it later. It will wait for you here."
          action={
            <Button variant="secondary" asChild>
              <Link href="/#news">Back to latest news</Link>
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<Newspaper />}
          title="No news yet"
          description="Company updates, team stories and announcements will appear here as soon as someone publishes one."
          action={
            canAuthor ? (
              <Button asChild>
                <Link href="/news/new">Write the first post</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </section>
  );
}
