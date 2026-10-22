"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Keyboard,
  Maximize,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { OrgChartPerson } from "@lobby/core/people";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { BeamPath } from "@/components/ui/effects/animated-beam";
import { Panel3D } from "@/components/ui/motion";
import { HeroLight } from "@/components/ui/hero-light";
import { cn } from "@/lib/cn";

const NODE_W = 264;
const NODE_H = 64;
const H_GAP = 24;
const V_GAP = 48;
const STACK_TOP = 14;
const STACK_GAP = 10;
const STACK_INDENT = 28;
const MIN_K = 0.15;
const MAX_K = 2;

interface Tree {
  byId: Map<string, OrgChartPerson>;
  children: Map<string, string[]>;
  parent: Map<string, string | null>;
  roots: string[];
  /** Everyone underneath a person, for "team of N". */
  teamSize: Map<string, number>;
}

function buildTree(people: OrgChartPerson[]): Tree {
  const byId = new Map(people.map((p) => [p.id, p]));
  const children = new Map<string, string[]>();
  const parent = new Map<string, string | null>();
  const roots: string[] = [];
  for (const p of people) {
    const m = p.managerId && byId.has(p.managerId) && p.managerId !== p.id ? p.managerId : null;
    parent.set(p.id, m);
    if (m) children.set(m, [...(children.get(m) ?? []), p.id]);
    else roots.push(p.id);
  }
  // Break any reporting loop so every person is reachable from a root.
  const reachable = new Set<string>();
  const walk = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const c of children.get(id) ?? []) walk(c);
  };
  roots.forEach(walk);
  for (const p of people)
    if (!reachable.has(p.id)) {
      roots.push(p.id);
      walk(p.id);
    }
  // Managers first (by team size), then alphabetical: the usual way org charts read.
  const teamSize = new Map<string, number>();
  const size = (id: string): number => {
    const cached = teamSize.get(id);
    if (cached !== undefined) return cached;
    teamSize.set(id, 0);
    const n = (children.get(id) ?? []).reduce((a, c) => a + 1 + size(c), 0);
    teamSize.set(id, n);
    return n;
  };
  people.forEach((p) => size(p.id));
  const order = (ids: string[]) =>
    ids.sort((a, b) => {
      const ka = (children.get(a)?.length ?? 0) > 0 ? 0 : 1;
      const kb = (children.get(b)?.length ?? 0) > 0 ? 0 : 1;
      return ka - kb || byId.get(a)!.displayName.localeCompare(byId.get(b)!.displayName);
    });
  order(roots);
  for (const ids of children.values()) order(ids);
  return { byId, children, parent, roots, teamSize };
}

interface Placed {
  id: string;
  x: number;
  y: number;
  depth: number;
}
interface Edge {
  key: string;
  from: string;
  to: string;
  d: string;
}

/**
 * Hybrid layout, the way most HR org charts read: the top level fans out left to right, and below
 * that each team is an indented column. Wide companies stay readable at a glance instead of
 * becoming one very long row.
 */
function layout(tree: Tree, expanded: Set<string>) {
  const placed = new Map<string, Placed>();
  const edges: Edge[] = [];
  const visibleKids = (id: string) => (expanded.has(id) ? (tree.children.get(id) ?? []) : []);

  // Vertical (indented) subtree: returns its width and height.
  const measureColumn = (id: string): { w: number; h: number } => {
    const kids = visibleKids(id);
    let w = NODE_W;
    let h = NODE_H;
    if (kids.length) h += STACK_TOP - STACK_GAP;
    for (const k of kids) {
      const m = measureColumn(k);
      w = Math.max(w, STACK_INDENT + m.w);
      h += STACK_GAP + m.h;
    }
    return { w, h };
  };
  const placeColumn = (id: string, x: number, y: number, depth: number): number => {
    placed.set(id, { id, x, y, depth });
    let cy = y + NODE_H + STACK_TOP;
    const spine = x + STACK_INDENT / 2;
    for (const k of visibleKids(id)) {
      const kx = x + STACK_INDENT;
      edges.push({
        key: `${id}-${k}`,
        from: id,
        to: k,
        d: `M${spine},${y + NODE_H} V${cy + NODE_H / 2} H${kx}`,
      });
      const h = placeColumn(k, kx, cy, depth + 1);
      cy += h + STACK_GAP;
    }
    return measureColumn(id).h;
  };

  // Horizontal top: each root fans its direct reports out in a row of columns.
  let left = 0;
  for (const r of tree.roots) {
    const kids = visibleKids(r);
    const cols = kids.map((k) => measureColumn(k));
    const rowW = cols.reduce((a, c) => a + c.w, 0) + H_GAP * Math.max(0, kids.length - 1);
    const w = Math.max(NODE_W, rowW);
    const rx = left + (w - NODE_W) / 2;
    placed.set(r, { id: r, x: rx, y: 0, depth: 0 });
    let cl = left + (w - rowW) / 2;
    const childY = NODE_H + V_GAP;
    const midY = NODE_H + V_GAP / 2;
    kids.forEach((k, i) => {
      const colW = cols[i]!.w;
      // Each column's head card sits at the column's left edge, so its team indents under it.
      const kx = cl;
      edges.push({
        key: `${r}-${k}`,
        from: r,
        to: k,
        d: `M${rx + NODE_W / 2},${NODE_H} V${midY} H${kx + NODE_W / 2} V${childY}`,
      });
      placeColumn(k, kx, childY, 1);
      cl += colW + H_GAP;
    });
    left += w + H_GAP * 3;
  }

  let maxX = 0;
  let maxY = 0;
  for (const p of placed.values()) {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  return { placed, edges, width: maxX, height: maxY };
}

type View = { x: number; y: number; k: number };

const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

export function OrgChart({
  people,
  focusId,
  viewerId,
}: {
  people: OrgChartPerson[];
  focusId: string | null;
  viewerId: string;
}) {
  const router = useRouter();
  const tree = React.useMemo(() => buildTree(people), [people]);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const nodeRefs = React.useRef(new Map<string, HTMLDivElement>());

  const ancestorsOf = React.useCallback(
    (id: string) => {
      const out: string[] = [];
      let cur = tree.parent.get(id) ?? null;
      while (cur && !out.includes(cur)) {
        out.push(cur);
        cur = tree.parent.get(cur) ?? null;
      }
      return out;
    },
    [tree],
  );

  const initialFocus = focusId && tree.byId.has(focusId) ? focusId : null;
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    // First paint is the root plus one level at 100 percent (audit C5); the reader expands down from there.
    for (const r of tree.roots) s.add(r);
    if (initialFocus) {
      for (const a of ancestorsOf(initialFocus)) s.add(a);
      s.add(initialFocus);
    }
    return s;
  });
  const [selected, setSelected] = React.useState<string | null>(initialFocus);
  const [active, setActive] = React.useState<string | null>(initialFocus ?? tree.roots[0] ?? null);
  // The node that actually holds keyboard focus (active is only the roving tabindex holder).
  const [focused, setFocused] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>({ x: 0, y: 0, k: 1 });
  const [animate, setAnimate] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [showKeys, setShowKeys] = React.useState(false);

  const { placed, edges, width, height } = React.useMemo(
    () => layout(tree, expanded),
    [tree, expanded],
  );

  const viewport = () => {
    const el = viewportRef.current;
    return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 1000, h: 700 };
  };

  const smooth = (next: View) => {
    setAnimate(true);
    setView(next);
    window.setTimeout(() => setAnimate(false), 260);
  };

  const fit = React.useCallback(
    (animated = true) => {
      const { w, h } = viewport();
      const pad = 48;
      const k = clampK(
        Math.min((w - pad * 2) / Math.max(width, 1), (h - pad * 2) / Math.max(height, 1), 1),
      );
      const next = { k, x: (w - width * k) / 2, y: Math.max(pad, (h - height * k) / 2) };
      if (animated) smooth(next);
      else setView(next);
    },
    [width, height],
  );

  const centerOn = React.useCallback(
    (id: string, k?: number, animated = true) => {
      const p = placed.get(id);
      if (!p) return;
      const { w, h } = viewport();
      const kk = clampK(k ?? Math.max(view.k, 0.85));
      const next = {
        k: kk,
        x: w / 2 - (p.x + NODE_W / 2) * kk,
        // The selection panel docks beside (or under) the canvas, so the person can sit mid-canvas.
        y: h * 0.42 - (p.y + NODE_H / 2) * kk,
      };
      if (animated) smooth(next);
      else setView(next);
    },
    [placed, view.k],
  );

  // First paint: fit the chart, or centre the person we were asked to show.
  const didInit = React.useRef(false);
  React.useLayoutEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (initialFocus) {
      // Open on the whole line above the person: every manager up to the top, the person and their
      // reports, fitted (never above 100 percent, never below 55) so the lit connectors read end to end.
      const ids = [initialFocus, ...ancestorsOf(initialFocus), ...(tree.children.get(initialFocus) ?? [])];
      const boxes = ids.map((id) => placed.get(id)).filter((p): p is Placed => !!p);
      const { w, h: ch } = viewport();
      // The canvas can run past the bottom of the window; fit to the part a reader can see.
      const top = viewportRef.current?.getBoundingClientRect().top ?? 0;
      const h = Math.min(ch, window.innerHeight - top - 16);
      const fitK = (bw: number, bh: number, pt: number, pb: number) => Math.min(1, (w - 96) / bw, (h - pt - pb) / bh);
      if (boxes.length > 1) {
        const x0 = Math.min(...boxes.map((b) => b.x));
        const y0 = Math.min(...boxes.map((b) => b.y));
        const x1 = Math.max(...boxes.map((b) => b.x + NODE_W));
        const y1 = Math.max(...boxes.map((b) => b.y + NODE_H));
        // The selection panel is docked outside the canvas, so the fit only needs breathing room.
        const padTop = w >= 768 ? 40 : 32;
        const padBottom = w >= 768 ? 40 : 32;
        const k = fitK(x1 - x0, y1 - y0, padTop, padBottom);
        // Too small to read (a deep line on a phone): centre on the person instead.
        if (k < (w >= 768 ? 0.6 : 0.85)) centerOn(initialFocus, 1, false);
        else {
          const cx = w / 2;
          setView({ k, x: cx - ((x0 + x1) / 2) * k, y: padTop - y0 * k });
        }
      } else centerOn(initialFocus, 1, false);
    } else {
      // Root plus one level at 100 percent, centred on the root, 48px from the top. "Fit" is a button, not the default.
      const { w } = viewport();
      const root = tree.roots[0] ? placed.get(tree.roots[0]) : undefined;
      if (root) setView({ k: 1, x: w / 2 - (root.x + NODE_W / 2), y: 48 });
      else fit(false);
    }
    setReady(true);
  }, [ancestorsOf, centerOn, fit, initialFocus, placed, tree.children, tree.roots]);

  // When the canvas changes size (the selection panel docking in or out, a rotated phone), bring the
  // selected person back into view if the new edges cut them off.
  const keepInView = React.useRef<() => void>(() => {});
  keepInView.current = () => {
    if (!selected) return;
    const el = nodeRefs.current.get(selected);
    const vp = viewportRef.current;
    if (!el || !vp) return;
    const a = el.getBoundingClientRect();
    const b = vp.getBoundingClientRect();
    if (a.left < b.left + 8 || a.right > b.right - 8 || a.top < b.top + 8 || a.bottom > b.bottom - 8) centerOn(selected);
  };
  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === "undefined") return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      keepInView.current();
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  // Selecting someone opens their reports and frames them: their manager above, them, and the
  // people under them, so a click never leaves the reader looking at an empty canvas.
  const [pendingFrame, setPendingFrame] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!pendingFrame) return;
    const kids = tree.children.get(pendingFrame) ?? [];
    if (kids.some((k) => !placed.has(k))) return;
    const up = tree.parent.get(pendingFrame);
    const ids = [pendingFrame, ...(up ? [up] : []), ...kids];
    const boxes = ids.map((id) => placed.get(id)).filter((b): b is Placed => !!b);
    setPendingFrame(null);
    if (!boxes.length) return;
    const { w, h } = viewport();
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + NODE_W));
    const y1 = Math.max(...boxes.map((b) => b.y + NODE_H));
    const k = Math.min(1, (w - 96) / (x1 - x0), (h - 96) / (y1 - y0));
    if (k < (w >= 768 ? 0.6 : 0.85)) {
      centerOn(pendingFrame, 1);
      return;
    }
    smooth({ k, x: w / 2 - ((x0 + x1) / 2) * k, y: Math.max(40, (h - (y1 - y0) * k) / 2) - y0 * k });
  }, [pendingFrame, placed, tree, centerOn]);

  // A pending "centre on" request that waits for the layout to include the node.
  const [pendingCenter, setPendingCenter] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (pendingCenter && placed.has(pendingCenter)) {
      centerOn(pendingCenter);
      setPendingCenter(null);
    }
  }, [pendingCenter, placed, centerOn]);

  const jumpTo = (id: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      ancestorsOf(id).forEach((a) => s.add(a));
      return s;
    });
    setSelected(id);
    setActive(id);
    setPendingCenter(id);
    requestAnimationFrame(() => nodeRefs.current.get(id)?.focus({ preventScroll: true }));
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  // ---- pan, wheel and pinch ------------------------------------------------------------------
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const drag = React.useRef<{
    startX: number;
    startY: number;
    view: View;
    moved: boolean;
    pinch?: { dist: number; mid: { x: number; y: number }; view: View };
  } | null>(null);
  const suppressClick = React.useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("[data-no-pan]")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const rect = viewportRef.current!.getBoundingClientRect();
      drag.current = {
        startX: 0,
        startY: 0,
        view,
        moved: true,
        pinch: {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          mid: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
          view,
        },
      };
    } else {
      drag.current = { startX: e.clientX, startY: e.clientY, view, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (d.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const k = clampK(d.pinch.view.k * (Math.hypot(a.x - b.x, a.y - b.y) / d.pinch.dist));
      const { mid, view: v } = d.pinch;
      setView({ k, x: mid.x - ((mid.x - v.x) / v.k) * k, y: mid.y - ((mid.y - v.y) / v.k) * k });
      return;
    }
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (drag.current?.moved) suppressClick.current = true;
    if (pointers.current.size === 0) drag.current = null;
    else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()] as [{ x: number; y: number }];
      drag.current = { startX: p.x, startY: p.y, view, moved: true };
    }
    window.setTimeout(() => (suppressClick.current = false), 0);
  };

  const zoomAt = React.useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const { w, h } = viewport();
      const px = cx ?? w / 2;
      const py = cy ?? h / 2;
      const k = clampK(v.k * factor);
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    });
  }, []);

  // Wheel needs a non-passive listener to stop the page scrolling.
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch and ctrl+wheel zoom around the pointer.
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      } else if (
        e.deltaMode === 0 &&
        Math.abs(e.deltaX) + Math.abs(e.deltaY) < 60 &&
        !Number.isInteger(e.deltaY)
      ) {
        // Trackpad two-finger scroll pans.
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      } else {
        // A mouse wheel zooms, like a map.
        zoomAt(e.deltaY > 0 ? 1 / 1.15 : 1.15, e.clientX - rect.left, e.clientY - rect.top);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ---- keyboard ------------------------------------------------------------------------------
  const ensureVisible = (id: string) => {
    const p = placed.get(id);
    if (!p) return;
    const { w, h } = viewport();
    const sx = p.x * view.k + view.x;
    const sy = p.y * view.k + view.y;
    const m = 40;
    if (sx < m || sy < m || sx + NODE_W * view.k > w - m || sy + NODE_H * view.k > h - m)
      centerOn(id, view.k);
  };

  const moveTo = (id: string | undefined | null) => {
    if (!id) return;
    setActive(id);
    nodeRefs.current.get(id)?.focus({ preventScroll: true });
    ensureVisible(id);
  };

  const onNodeKey = (e: React.KeyboardEvent, id: string) => {
    const kids = tree.children.get(id) ?? [];
    const parent = tree.parent.get(id) ?? null;
    const siblings = parent ? (tree.children.get(parent) ?? []) : tree.roots;
    const i = siblings.indexOf(id);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!kids.length) return;
        if (!expanded.has(id)) {
          toggle(id);
          setPendingCenter(kids[0]!);
          setActive(kids[0]!);
          requestAnimationFrame(() =>
            nodeRefs.current.get(kids[0]!)?.focus({ preventScroll: true }),
          );
        } else moveTo(kids[0]);
        return;
      case "ArrowUp":
        e.preventDefault();
        moveTo(parent);
        return;
      case "ArrowLeft":
        e.preventDefault();
        moveTo(siblings[i - 1]);
        return;
      case "ArrowRight":
        e.preventDefault();
        moveTo(siblings[i + 1]);
        return;
      case "Home":
        e.preventDefault();
        moveTo(tree.roots[0]);
        return;
      case " ":
        e.preventDefault();
        if (kids.length) toggle(id);
        return;
      case "Enter":
        e.preventDefault();
        router.push(`/people/${id}`);
        return;
      case "Escape":
        setSelected(null);
        return;
    }
  };

  const onCanvasKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomAt(1.2);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomAt(1 / 1.2);
    } else if (e.key === "0") {
      e.preventDefault();
      fit();
    } else if (e.key === "?") {
      setShowKeys((s) => !s);
    }
  };

  const expandAll = () => setExpanded(new Set([...tree.children.keys()]));
  const collapseAll = () => {
    setExpanded(new Set(tree.roots));
    setPendingCenter(tree.roots[0] ?? null);
  };

  const sel = selected ? tree.byId.get(selected) : null;
  const visibleCount = placed.size;

  // The connectors that light up: from the manager down to the selected (or focused) person, and
  // from them out to their reports. They draw on, carry a spark or two, then settle lit; every
  // other connector stays quiet.
  const litId = selected ?? focused;
  // The whole reporting line lights, top down: root to the person, one hop after another, then
  // the fan-out to their reports. `chain` is the person plus every manager above them.
  const chain = React.useMemo(
    () => (litId ? [litId, ...ancestorsOf(litId)] : []),
    [litId, ancestorsOf],
  );
  const litEdges = React.useMemo(() => {
    if (!litId) return [] as (Edge & { order: number; hop: boolean })[];
    const depth = new Map(chain.map((id, i) => [id, chain.length - 1 - i]));
    const out: (Edge & { order: number; hop: boolean })[] = [];
    for (const e of edges) {
      const d = depth.get(e.to);
      if (d !== undefined && depth.has(e.from)) out.push({ ...e, order: d - 1, hop: true });
    }
    const hops = out.length;
    let i = 0;
    for (const e of edges)
      if (e.from === litId) out.push({ ...e, order: hops + i++ * 0.25, hop: false });
    return out;
  }, [edges, litId, chain]);
  const above = React.useMemo(() => new Set(chain.slice(1)), [chain]);
  const edgeScale = 1 / Math.max(view.k, 0.6);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" onKeyDown={onCanvasKey}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 pb-3 sm:px-6 lg:px-8">
        <JumpTo people={people} onPick={jumpTo} />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className="tabular mr-2 hidden text-small text-muted md:inline" aria-live="polite">
            Showing {visibleCount} of {people.length}
          </span>
          {/* Visible labels at `sm` and up (audit C6); icon-only with the same accessible name below. */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted hover:text-fg sm:w-auto sm:px-2.5 md:w-auto"
            onClick={expandAll}
            aria-label="Expand everyone"
          >
            <ChevronsUpDown aria-hidden />
            <span className="hidden sm:inline">Expand all</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted hover:text-fg sm:w-auto sm:px-2.5 md:w-auto"
            onClick={collapseAll}
            aria-label="Collapse to the top"
          >
            <ChevronsDownUp aria-hidden />
            <span className="hidden sm:inline">Collapse</span>
          </Button>
          <Tooltip label="Keyboard shortcuts" shortcut="?">
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-muted hover:text-fg sm:inline-flex"
              onClick={() => setShowKeys((s) => !s)}
              aria-label="Keyboard shortcuts"
              aria-pressed={showKeys}
            >
              <Keyboard />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Canvas, with the selected person docked beside it. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-clip md:flex-row">
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden rounded-t-panel bg-sunken/60 shadow-inset active:cursor-grabbing dark:bg-sunken"
        // A dot grid that pans and zooms with the chart, so dragging reads as moving a canvas.
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--lb-border-strong) 1px, transparent 1.4px)",
          backgroundSize: `${24 * view.k}px ${24 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (!suppressClick.current && e.target === e.currentTarget) setSelected(null);
        }}
      >
        <div
          role="tree"
          aria-label="Org chart. Use arrow keys to move between people."
          className={cn(
            "absolute left-0 top-0 origin-top-left",
            animate &&
              "transition-transform duration-240 ease-standard motion-reduce:transition-none",
            !ready && "opacity-0",
          )}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            width,
            height,
          }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={width}
            height={height}
            aria-hidden
          >
            {edges.map((e) => (
              <path
                key={e.key}
                d={e.d}
                fill="none"
                stroke="var(--lb-border-strong)"
                strokeWidth={edgeScale * 1.25}
                strokeLinejoin="round"
                // With someone selected, every other connector steps back so their line reads.
                className={cn("transition-opacity duration-300", selected && "opacity-40")}
              />
            ))}
            {litEdges.map((e) => (
              <BeamPath
                key={`${e.key}:${litId}`}
                d={e.d}
                quiet={false}
                tone="accent"
                width={edgeScale * 1.25}
                scale={edgeScale}
                draw="before"
                drawDuration={0.32}
                delay={e.order * 0.34}
                repeat={e.hop ? 1 : 0}
              />
            ))}
          </svg>
          {[...placed.values()].map((p) => {
            const person = tree.byId.get(p.id)!;
            const kids = tree.children.get(p.id) ?? [];
            const open = expanded.has(p.id);
            const isSel = selected === p.id;
            const onLine = above.has(p.id);
            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(p.id, el);
                  else nodeRefs.current.delete(p.id);
                }}
                role="treeitem"
                aria-level={p.depth + 1}
                aria-expanded={kids.length ? open : undefined}
                aria-selected={isSel}
                aria-label={`${person.displayName}, ${person.title ?? "no title"}${kids.length ? `, ${kids.length} direct ${kids.length === 1 ? "report" : "reports"}` : ""}`}
                tabIndex={active === p.id ? 0 : -1}
                onFocus={() => {
                  setActive(p.id);
                  setFocused(p.id);
                }}
                onBlur={() => setFocused((f) => (f === p.id ? null : f))}
                onKeyDown={(e) => onNodeKey(e, p.id)}
                onClick={() => {
                  if (suppressClick.current) return;
                  setSelected(p.id);
                  setActive(p.id);
                  if (kids.length) setExpanded((prev) => (prev.has(p.id) ? prev : new Set(prev).add(p.id)));
                  setPendingFrame(p.id);
                }}
                onDoubleClick={() => router.push(`/people/${p.id}`)}
                className={cn(
                  "group absolute flex cursor-pointer items-center gap-2.5 rounded-card cell pl-2.5 pr-2.5 outline-none",
                  "transition-[box-shadow,background-color] duration-160 ease-standard",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring",
                  isSel
                    ? "[box-shadow:0_0_0_2px_var(--lb-accent),0_10px_30px_-8px_rgb(from_var(--lb-accent)_r_g_b/0.45),var(--lb-shadow-cell-hover)]"
                    : onLine
                      ? "[box-shadow:0_0_0_1px_rgb(from_var(--lb-accent)_r_g_b/0.45),var(--lb-shadow-cell)] hover:shadow-cell-hover"
                      : "hover:shadow-cell-hover",
                )}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              >
                <Avatar
                  name={person.displayName}
                  seed={person.id}
                  src={person.avatarUrl}
                  size="lg"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-body font-medium text-fg">
                      {person.displayName}
                    </span>
                    {person.id === viewerId ? (
                      <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-caption font-medium leading-4 text-accent-text">
                        You
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-small text-muted">
                    {person.title ?? "No title yet"}
                  </span>
                </div>
                {kids.length ? (
                  <button
                    type="button"
                    data-no-pan
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(p.id);
                    }}
                    aria-label={
                      open
                        ? `Hide ${person.displayName}'s reports`
                        : `Show ${person.displayName}'s ${kids.length} reports`
                    }
                    className={cn(
                      "touch-target press inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full pl-2.5 pr-2 text-caption font-medium",
                      open
                        ? "bg-sunken text-fg hover:bg-hover"
                        : "bg-accent-soft text-accent-text hover:shadow-cell",
                    )}
                  >
                    <span className="tabular">{kids.length}</span>
                    {open ? (
                      <ChevronUp className="size-3 stroke-[2]" aria-hidden />
                    ) : (
                      <ChevronDown className="size-3 stroke-[2]" aria-hidden />
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Zoom controls */}
        {/* Zoom: one control bar, the way a map or a canvas tool does it. */}
        <div
          data-no-pan
          role="group"
          aria-label="Zoom"
          className={cn(
            "absolute bottom-4 right-4 flex items-center rounded-full bg-raised p-1 shadow-popover sm:bottom-auto sm:top-4",
          )}
        >
          <Tooltip label="Zoom out" shortcut="-">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => zoomAt(1 / 1.25)}
              aria-label="Zoom out"
            >
              <Minus />
            </Button>
          </Tooltip>
          <output
            className="tabular w-12 text-center text-small text-muted"
            aria-live="polite"
            aria-label="Zoom level"
          >
            {Math.round(view.k * 100)}%
          </output>
          <Tooltip label="Zoom in" shortcut="+">
            <Button variant="ghost" size="icon" onClick={() => zoomAt(1.25)} aria-label="Zoom in">
              <Plus />
            </Button>
          </Tooltip>
          <Tooltip label="Fit everyone on screen" shortcut="0">
            <Button
              variant="ghost"
              size="icon"
              className="ml-1"
              onClick={() => fit()}
              aria-label="Fit to screen"
            >
              <Maximize />
            </Button>
          </Tooltip>
        </div>

        {showKeys ? (
          <div
            data-no-pan
            className="absolute right-4 top-16 w-[260px] rounded-card bg-raised p-4 text-small shadow-popover"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-fg">Keyboard</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowKeys(false)}
                aria-label="Close shortcuts"
              >
                <X />
              </Button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-muted">
              <dt>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd>
              </dt>
              <dd>Manager, first report</dd>
              <dt>
                <Kbd>←</Kbd> <Kbd>→</Kbd>
              </dt>
              <dd>Previous, next peer</dd>
              <dt>
                <Kbd>Space</Kbd>
              </dt>
              <dd>Show or hide reports</dd>
              <dt>
                <Kbd>Enter</Kbd>
              </dt>
              <dd>Open profile</dd>
              <dt>
                <Kbd>+</Kbd> <Kbd>-</Kbd>
              </dt>
              <dd>Zoom</dd>
              <dt>
                <Kbd>0</Kbd>
              </dt>
              <dd>Fit to screen</dd>
            </dl>
          </div>
        ) : null}

      </div>

        {/* Selected person: a docked panel beside the canvas (below it on a phone), never over the tree. */}
        {sel ? (
          <SelectedPerson
            key={sel.id}
            person={sel}
            reports={tree.children.get(sel.id)?.length ?? 0}
            team={tree.teamSize.get(sel.id) ?? 0}
            line={chain.length > 1 && selected === sel.id ? [...chain].reverse().map((id) => tree.byId.get(id)!) : []}
            manager={(() => {
              const m = tree.parent.get(sel.id);
              return m ? (tree.byId.get(m) ?? null) : null;
            })()}
            isViewer={sel.id === viewerId}
            directs={(tree.children.get(sel.id) ?? []).map((id) => tree.byId.get(id)!).filter(Boolean)}
            onJump={jumpTo}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The selected person, docked: beside the canvas from md up (the canvas narrows, so the panel can
 * never sit over a node), and under it on a phone. It swings in with Panel3D and is lit blue
 * (information). From md it shows the reporting line top down as the same cells the chart uses.
 */
function SelectedPerson({
  person,
  reports,
  team,
  line,
  manager,
  isViewer,
  directs,
  onJump,
  onClose,
}: {
  person: OrgChartPerson;
  /** Their direct reports, shown under the line so the panel says who they lead. */
  directs: OrgChartPerson[];
  reports: number;
  team: number;
  /** Top of the company down to the person; empty for the top of the tree. */
  line: OrgChartPerson[];
  manager: OrgChartPerson | null;
  isViewer: boolean;
  onJump: (id: string) => void;
  onClose: () => void;
}) {
  // The selected person is the last row of their line: keep them in view when the line is long.
  const lineRef = React.useRef<HTMLOListElement>(null);
  React.useEffect(() => {
    const el = lineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  const facts = [
    { label: "Direct reports", value: reports ? String(reports) : "None" },
    { label: "In their team", value: team ? String(team) : "Just them" },
  ];
  return (
    <Panel3D
      side="right"
      data-no-pan
      role="region"
      aria-label={`Selected: ${person.displayName}`}
      className="panel relative isolate flex max-h-[44%] shrink-0 flex-col gap-3 overflow-hidden rounded-t-panel p-3 max-md:mt-2 max-md:overflow-y-auto md:ml-3 md:max-h-none md:w-[360px] md:gap-4 md:p-5 md:pb-10"
    >
      <HeroLight tone="blue" position="top-right" />
      <div className="flex min-w-0 items-center gap-3 md:flex-col md:items-start md:gap-4">
        <Avatar name={person.displayName} seed={person.id} src={person.avatarUrl} size="xl" className="max-md:size-10" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col md:gap-1">
          <h2 className="flex min-w-0 items-center gap-2 text-row font-medium text-fg md:text-h2">
            <span className="truncate md:whitespace-normal">{person.displayName}</span>
            {isViewer ? (
              <span className="shrink-0 rounded-full bg-accent-soft px-2 text-caption font-medium leading-6 text-accent-text">You</span>
            ) : null}
          </h2>
          <p className="truncate text-small text-muted md:whitespace-normal md:text-row">{person.title ?? "No title yet"}</p>
          {person.department || person.location ? (
            <p className="hidden text-small text-muted md:block">{[person.department, person.location].filter(Boolean).join(", ")}</p>
          ) : null}
          {manager ? (
            <p className="hidden text-small text-muted md:block">
              Reports to{" "}
              <button type="button" onClick={() => onJump(manager.id)} className="focus-ring -my-1 inline-flex min-h-7 items-center rounded-sm py-1 font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                {manager.displayName}
              </button>
            </p>
          ) : null}
        </div>
        <Button asChild size="sm" variant="secondary" className="md:hidden">
          <Link href={`/people/${person.id}`}>View profile</Link>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="shrink-0 md:absolute md:right-3 md:top-3">
          <X />
        </Button>
      </div>

      <dl className="hidden grid-cols-2 gap-2 md:grid">
        {facts.map((f) => (
          <div key={f.label} className="cell flex min-w-0 flex-col rounded-card px-3.5 py-2">
            <dt className="text-caption text-muted">{f.label}</dt>
            <dd className="tabular truncate text-row font-medium text-fg">{f.value}</dd>
          </div>
        ))}
      </dl>

      {line.length ? (
        <>
          {/* Desktop: the line top down, the same cells as the chart, joined by the lit connector. */}
          <section aria-label="Reporting line" className="hidden min-h-0 flex-1 flex-col gap-2 md:flex">
            <h3 className="text-small font-medium text-muted">Reporting line</h3>
            <ol ref={lineRef} className="relative -m-1 flex min-h-0 flex-col gap-2 overflow-y-auto p-1">
              <span aria-hidden className="absolute bottom-6 left-[27px] top-6 w-0.5 rounded-full bg-accent/40 shadow-[0_0_10px_var(--lb-accent)]" />
              {line.map((m) => {
                const me = m.id === person.id;
                return (
                  <li key={m.id} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => onJump(m.id)}
                      aria-current={me ? "true" : undefined}
                      className={cn(
                        "cell focus-ring press flex min-h-12 w-full shrink-0 items-center gap-3 rounded-card px-3 py-1.5 text-left hover:shadow-cell-hover",
                        me && "shadow-[var(--lb-shadow-cell),0_0_0_2px_var(--lb-accent)]",
                      )}
                    >
                      <Avatar name={m.displayName} seed={m.id} src={m.avatarUrl} size="md" aria-hidden />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-row font-medium text-fg">{m.displayName}</span>
                        <span className="truncate text-caption text-muted">{m.title ?? "No title yet"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
          {/* Phone: the same line as a row of chips that scrolls sideways. */}
          <ol className="-mx-3 flex min-w-0 items-center gap-1 overflow-x-auto px-3 pb-0.5 md:hidden [scrollbar-width:none]" aria-label="Reporting line">
            {line.map((m, i) => (
              <li key={m.id} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onJump(m.id)}
                  className={cn(
                    "focus-ring press touch-target inline-flex h-8 items-center gap-1.5 rounded-full pl-0.5 pr-2.5 text-caption",
                    m.id === person.id ? "bg-accent-soft font-medium text-accent-text" : "bg-raised text-muted shadow-cell hover:text-fg",
                  )}
                  aria-current={m.id === person.id ? "true" : undefined}
                >
                  <Avatar name={m.displayName} seed={m.id} src={m.avatarUrl} size="sm" aria-hidden />
                  {m.displayName.split(/\s+/)[0]}
                </button>
                {i < line.length - 1 ? <ChevronRight className="size-3.5 shrink-0 stroke-[2] text-subtle" aria-hidden /> : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {directs.length ? (
        <section aria-label={`${person.displayName.split(/\s+/)[0]}'s direct reports`} className="hidden min-h-0 shrink-0 flex-col gap-2 md:flex">
          <h3 className="text-small font-medium text-muted">Leads {directs.length} {directs.length === 1 ? "person" : "people"}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {directs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onJump(d.id)}
                  className="focus-ring press inline-flex h-9 items-center gap-2 rounded-full bg-raised pl-1 pr-3 text-small text-fg shadow-cell hover:shadow-cell-hover"
                >
                  <Avatar name={d.displayName} seed={d.id} src={d.avatarUrl} size="sm" aria-hidden />
                  {d.displayName.split(/\s+/)[0]}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button asChild className="mt-auto hidden shrink-0 md:inline-flex">
        <Link href={`/people/${person.id}`}>View profile</Link>
      </Button>
    </Panel3D>
  );
}

function JumpTo({ people, onPick }: { people: OrgChartPerson[]; onPick: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || (el && ["INPUT", "TEXTAREA"].includes(el.tagName))) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="min-w-0 flex-1 justify-start text-muted sm:w-[280px] sm:flex-none"
        >
          <Search aria-hidden />
          <span className="truncate">Jump to a person</span>
          <Kbd className="ml-auto hidden sm:inline-flex">/</Kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(340px,calc(100vw-32px))] p-0" align="start">
        <Command
          filter={(value, search) => {
            const p = people.find((x) => x.id === value);
            const hay =
              `${p?.displayName ?? ""} ${p?.title ?? ""} ${p?.department ?? ""}`.toLowerCase();
            return search
              .toLowerCase()
              .split(/\s+/)
              .every((t) => hay.includes(t))
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder="Name, title or team" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No one by that name.</CommandEmpty>
            {people.map((p) => (
              <CommandItem
                key={p.id}
                value={p.id}
                className="h-auto min-h-11 py-1.5 md:h-auto"
                onSelect={() => {
                  setOpen(false);
                  onPick(p.id);
                }}
              >
                <Avatar name={p.displayName} seed={p.id} src={p.avatarUrl} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{p.displayName}</span>
                  <span className="truncate text-caption text-muted">{p.title ?? ""}</span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
