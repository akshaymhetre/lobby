import { Briefcase, Building2, Code2, Coffee, MapPin, Package, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { CategoryTone } from "@/components/ui/category-block";

/**
 * Each news category is a filled category block (the planner's gradient language), so a story's
 * section reads at a glance instead of as a grey uppercase kicker. Unknown categories (an author can
 * type a new one) fall back to teal with a briefcase.
 */
const MAP: Record<string, { tone: CategoryTone; icon: LucideIcon }> = {
  // Company news is teal, not blue: blue is the product's action colour (Ask, links) and the planner's requests.
  Company: { tone: "teal", icon: Building2 },
  People: { tone: "violet", icon: Users },
  Engineering: { tone: "blue", icon: Code2 },
  Workplace: { tone: "green", icon: MapPin },
  Culture: { tone: "coral", icon: Coffee },
  Sales: { tone: "amber", icon: TrendingUp },
  Product: { tone: "blue", icon: Package },
};

export function newsTone(category: string): { tone: CategoryTone; icon: LucideIcon } {
  return MAP[category] ?? { tone: "teal", icon: Briefcase };
}

/** Literal class names so Tailwind generates every fill. */
export const FILL: Record<CategoryTone, string> = {
  violet: "cat-violet",
  green: "cat-green",
  blue: "cat-blue",
  amber: "cat-amber",
  coral: "cat-coral",
  teal: "cat-teal",
};

/** A story's category as a small filled pill: icon disc and name, in the category gradient. */
export function NewsCategoryPill({ category, className }: { category: string; className?: string }) {
  const { tone, icon: Icon } = newsTone(category);
  return (
    <span
      className={`${FILL[tone]} inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-caption font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] ${className ?? ""}`}
    >
      <span aria-hidden className={`inline-flex size-5 items-center justify-center rounded-full ${tone === "amber" ? "bg-white/45" : "bg-white/20"}`}>
        <Icon className="size-3 stroke-[2]" />
      </span>
      {category}
    </span>
  );
}

export interface StoryFigure {
  /** The figure as written: "31%", "4.7 out of 5", "118%". */
  value: string;
  /** Up to three words before it, as the figure's label: "Revenue grew", "net retention passed". */
  label: string;
}

/**
 * The numbers a story is about, read out of its own text, so a cover can set them big instead of
 * an ornament. Percentages and "N out of M" scores only; at most `max`, one per sentence, each with
 * the words that lead into it as its label. Returns [] when the text has none.
 */
const VERBS = new Set(["up", "down", "grew", "rose", "fell", "passed", "held", "at", "reached", "hit", "was", "is", "were", "are", "of", "by", "to", "increased", "dropped", "improved", "stayed", "now", "about", "over", "under", "nearly", "almost"]);

const GROWTH = new Set(["up", "grew", "rose", "increased", "improved"]);

export function storyFigures(text: string, max = 3): StoryFigure[] {
  const plain = text.replace(/<\/(p|li|h2|h3)>/g, ". ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const out: StoryFigure[] = [];
  const re = /(\d+(?:\.\d+)?\s?%|\d+(?:\.\d+)?\s+out of\s+\d+)/gi;
  for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
    let from = 0;
    for (const m of sentence.matchAll(re)) {
      const lead = sentence.slice(from, m.index).replace(/[,;:]+\s*$/, "").trim();
      from = m.index! + m[0].length;
      const words = lead.split(" ").filter(Boolean);
      // Keep the noun, drop the verb that led into the number: "Net retention passed" -> "Net retention".
      const kept = words.slice(-4);
      let grew = false;
      while (kept.length > 1 && VERBS.has(kept[kept.length - 1]!.toLowerCase())) {
        if (GROWTH.has(kept[kept.length - 1]!.toLowerCase())) grew = true;
        kept.pop();
      }
      // "Revenue grew 31%" is growth, not a share: say so.
      const label = (kept.slice(-3).join(" ") + (grew ? " growth" : "")).replace(/^(and|but|while|the|our)\s+/i, "");
      // The summary usually repeats the body's headline figure: keep the first telling of each number.
      if (!label || out.some((f) => f.value === m[1]!.replace(/\s+%/, "%"))) continue;
      out.push({ value: m[1]!.replace(/\s+%/, "%"), label: label.charAt(0).toUpperCase() + label.slice(1) });
      if (out.length >= max) return out;
    }
  }
  return out;
}
