import type * as React from "react";
import Link from "next/link";
import { Clock, Pencil, Pin } from "lucide-react";
import { canAuthorPosts, getPost, listFeed } from "@lobby/core/home";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/page";
import { Breadcrumb } from "@/components/ui/page-header";
import { CountUp, Reveal, RevealItem, Words } from "@/components/ui/motion";
import { CategoryChip } from "@/components/ui/category-block";
import { PostByline } from "@/components/home/feed";
import { FILL, NewsCategoryPill, newsTone, storyFigures } from "@/components/home/news-tone";
import { NotFoundTrigger } from "@/app/(app)/[...rest]/not-found-trigger";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { PostActions } from "@/components/home/post-actions";
import { Comments } from "@/components/home/comments";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const post = await getPost(ctx, (await params).id);
  return { title: post ? post.title : "News" };
}

/**
 * Body styles for the editor's sanitized HTML. The first paragraph is the lede, set a size up;
 * section heads are 24px, so the story's sections are a
 * clear jump instead of a run of same-size grey text; list markers carry the category colour.
 */
const prose =
  "text-body-lg text-fg [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-2 [&_em]:italic " +
  "[&>p:first-child]:text-h4 [&>p:first-child]:text-pretty " +
  "[&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-h2 [&_h2]:font-medium [&_h2]:text-balance " +
  "[&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:text-h3 [&_h3]:font-medium " +
  "[&_li]:mb-2 [&_li]:pl-1 [&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_li::marker]:font-medium [&_ol_li::marker]:text-[var(--story)] [&_p]:mb-5 [&_strong]:font-medium " +
  "[&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ul_li::marker]:text-[var(--story)] " +
  "[&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--story)] [&_blockquote]:pl-5 [&_blockquote]:text-h3 [&_blockquote]:font-medium [&_blockquote]:text-fg";

/** The story's category colour as a CSS value, for the prose rules and markers. */
const STORY: Record<string, string> = {
  violet: "var(--lb-cat-violet-to)",
  green: "var(--lb-cat-green-to)",
  blue: "var(--lb-cat-blue-to)",
  amber: "var(--lb-cat-amber-to)",
  coral: "var(--lb-cat-coral-to)",
  teal: "var(--lb-cat-teal-to)",
};

export default async function NewsPostPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const { id } = await params;
  const post = await getPost(ctx, id);
  // Thrown from the client tree: see app/(app)/[...rest]/page.tsx for the dev-overlay reason.
  if (!post) return <NotFoundTrigger />;
  const more = (await listFeed(ctx, { limit: 5 })).filter((p) => p.id !== post.id).slice(0, 3);
  const { tone, icon: Icon } = newsTone(post.category);
  const onImage = !!post.coverImageUrl;
  // The numbers the story is about, set big on the cover (none: the category glyph instead).
  const figures = storyFigures(`${post.summary ?? ""} ${post.body}`, 3);
  const words = post.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return (
    <Page width="wide">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "News", href: "/#news" },
            { label: post.category },
          ]}
        />
        {canAuthorPosts(ctx) ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/news/${post.id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </Button>
        ) : null}
      </div>
      <article className="mt-5 flex flex-col gap-8 md:gap-10" style={{ "--story": STORY[tone] } as React.CSSProperties}>
        {/*
          The cover: the story's category gradient (or its cover image under a scrim), full width,
          with the headline at the page-title size in white. Its one authored moment: the title
          arrives word by word, then the summary and byline build in.
        */}
        <header
          className={cn(
            "relative isolate overflow-hidden rounded-panel px-5 pb-6 pt-14 sm:px-10 sm:pb-9 sm:pt-24",
            onImage ? "bg-[#0d1b1f] text-white" : FILL[tone],
          )}
        >
          {onImage ? (
            <>
              <img src={post.coverImageUrl!} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />
            </>
          ) : figures.length ? (
            <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(80%_120%_at_0%_100%,rgb(0_0_0/0.2),transparent_60%),radial-gradient(60%_80%_at_100%_0%,rgb(255_255_255/0.18),transparent_60%)]" />
          ) : (
            <>
              <Icon aria-hidden className="pointer-events-none absolute -right-10 -top-14 -z-10 size-[340px] stroke-[1] opacity-[0.14]" />
              <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(80%_120%_at_0%_100%,rgb(0_0_0/0.2),transparent_60%),radial-gradient(60%_80%_at_100%_0%,rgb(255_255_255/0.18),transparent_60%)]" />
            </>
          )}
          <div className="flex flex-col gap-10 sm:gap-14">
          {figures.length ? (
            // The story's figures fill the top of the cover, counting up as it builds: what the
            // headline is about, at a glance, before a word of it is read.
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:gap-x-10">
              {figures.map((f, i) => (
                <div key={f.value + f.label} className="flex min-w-0 flex-col-reverse gap-1.5 border-l border-current/30 pl-3 sm:pl-5">
                  <dt className="line-clamp-2 text-small opacity-85 sm:text-body">{f.label}</dt>
                  <dd className="tabular text-title-sm font-medium leading-none tracking-[-0.03em] sm:text-[64px] lg:text-[88px]">
                    <FigureValue value={f.value} delay={0.5 + i * 0.12} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <Reveal stagger={0.07} delay={0.25} className="flex max-w-[880px] flex-col gap-4">
            <RevealItem from="fade" className="flex flex-wrap items-center gap-2">
              <CategoryChip tone={onImage ? undefined : tone}>{post.category}</CategoryChip>
              {post.pinned ? (
                <CategoryChip tone={onImage ? undefined : tone} className="gap-1.5">
                  <Pin className="size-3.5 stroke-[2]" aria-hidden />
                  Pinned
                </CategoryChip>
              ) : null}
              <CategoryChip tone={onImage ? undefined : tone} className="gap-1.5">
                <Clock className="size-3.5 stroke-[2]" aria-hidden />
                {minutes} min read
              </CategoryChip>
            </RevealItem>
            <h1 className="text-title-sm font-medium text-balance md:text-title lg:text-display">
              <span className="sr-only">{post.title}</span>
              <Words text={post.title} stagger={0.06} aria-hidden />
            </h1>
            {post.summary ? (
              <RevealItem>
                <p className="max-w-[60ch] text-h4 opacity-90 text-pretty">{post.summary}</p>
              </RevealItem>
            ) : null}
          </Reveal>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
          <div className="min-w-0 max-w-[680px]">
            {/* Post bodies are sanitized by the editor before they are stored. */}
            <div className={prose} dangerouslySetInnerHTML={{ __html: post.body }} />
            <div className="cell mt-8 flex rounded-card px-2 py-1.5">
              <PostActions
                className="flex-1"
                postId={post.id}
                title={post.title}
                likeCount={post.likeCount}
                liked={post.liked}
                commentCount={post.comments.length}
                saved={post.saved}
                commentsHref="#comments"
              />
            </div>
            <div className="mt-10">
              <Comments
                postId={post.id}
                me={{ id: ctx.user.id, name: ctx.user.displayName, avatarUrl: ctx.user.avatarUrl }}
                comments={post.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
              />
            </div>
          </div>

          {/* The rail: who wrote it, and what to read next. Sticky beside the story on wide screens. */}
          <aside aria-label="About this story" className="flex flex-col gap-4 self-start lg:sticky lg:top-4">
            <div className="cell flex flex-col gap-3 rounded-card p-4">
              <p className="text-small text-muted">Written by</p>
              <PostByline post={post} size="lg" />
            </div>
            {more.length ? (
              <section aria-labelledby="more-news" className="flex flex-col gap-3">
                <h2 id="more-news" className="px-1 text-h3 font-medium text-fg">
                  More news
                </h2>
                <ul className="flex flex-col gap-2">
                  {more.map((m) => (
                    <li key={m.id}>
                      <Link href={`/news/${m.id}`} className="cell focus-ring press flex flex-col gap-2 rounded-card p-4 hover:shadow-cell-hover">
                        <NewsCategoryPill category={m.category} className="self-start" />
                        <span className="line-clamp-2 text-row font-medium text-fg">{m.title}</span>
                        <span className="text-caption text-muted">{timeAgo(m.publishedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </article>
    </Page>
  );
}

/** "31%" counts up from zero; a score ("4.7 out of 5") sets the score big and "/5" at the label size. */
function FigureValue({ value, delay }: { value: string; delay: number }) {
  const score = /^(\d+(?:\.\d+)?)\s+out of\s+(\d+)$/i.exec(value);
  if (score)
    return (
      <>
        {score[1]}
        <span className="ml-1 text-h3 font-medium opacity-80 sm:text-h2">/{score[2]}</span>
      </>
    );
  const m = /^(\d+)(%?)$/.exec(value);
  if (!m) return <>{value}</>;
  return <CountUp value={Number(m[1])} duration={0.9} delay={delay} suffix={m[2]} />;
}
