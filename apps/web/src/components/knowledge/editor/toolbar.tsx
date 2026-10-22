"use client";

import * as React from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table2,
  Undo2,
  MessageSquareWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { CALLOUT_TONES, type CalloutTone } from "./callout";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(active && "bg-selected text-fg")}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;

const TONE_LABEL: Record<CalloutTone, string> = { info: "Note", warning: "Warning", success: "Tip", danger: "Important" };
const TONE_DOT: Record<CalloutTone, string> = { info: "bg-info", warning: "bg-warning", success: "bg-success", danger: "bg-danger" };

/** Only http(s), mailto and same-site paths are accepted, matching what the reader view renders. */
export function normaliseHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (v.startsWith("#")) return v;
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  return null;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const mod = isMac() ? "⌘" : "Ctrl";
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      callout: e.isActive("callout"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const block = s.h2 ? { label: "Heading", Icon: Heading2 } : s.h3 ? { label: "Subheading", Icon: Heading3 } : { label: "Text", Icon: Pilcrow };
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex items-center gap-0.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
    >
      <ToolButton label="Undo" shortcut={`${mod} Z`} disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Redo" shortcut={`${mod} Shift Z`} disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 />
      </ToolButton>
      <Divider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="w-[140px] shrink-0 justify-start gap-2" aria-label={`Block style: ${block.label}`} onMouseDown={(e) => e.preventDefault()}>
            <block.Icon aria-hidden className="text-muted" />
            <span className="flex-1 text-left">{block.label}</span>
            <ChevronDown aria-hidden className="text-subtle" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => chain().setParagraph().run()}>
            <Pilcrow aria-hidden /> Text
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => chain().toggleHeading({ level: 2 }).run()} shortcut={`${mod} Alt 2`}>
            <Heading2 aria-hidden /> Heading
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => chain().toggleHeading({ level: 3 }).run()} shortcut={`${mod} Alt 3`}>
            <Heading3 aria-hidden /> Subheading
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />
      <ToolButton label="Bold" shortcut={`${mod} B`} active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Italic" shortcut={`${mod} I`} active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label="Strikethrough" shortcut={`${mod} Shift S`} active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </ToolButton>
      <ToolButton label="Inline code" shortcut={`${mod} E`} active={s.code} onClick={() => chain().toggleCode().run()}>
        <Code />
      </ToolButton>
      <LinkButton editor={editor} active={s.link} shortcut={`${mod} K`} />
      <Divider />
      <ToolButton label="Bulleted list" shortcut={`${mod} Shift 8`} active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Numbered list" shortcut={`${mod} Shift 7`} active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Checklist" shortcut={`${mod} Shift 9`} active={s.task} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks />
      </ToolButton>
      <Divider />
      <ToolButton label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <ToolButton label="Code block" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <SquareCode />
      </ToolButton>
      <DropdownMenu>
        <Tooltip label="Callout">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Callout"
              aria-pressed={s.callout}
              className={cn(s.callout && "bg-selected text-fg")}
              onMouseDown={(e) => e.preventDefault()}
            >
              <MessageSquareWarning />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel>Callout</DropdownMenuLabel>
          {CALLOUT_TONES.map((tone) => (
            <DropdownMenuItem
              key={tone}
              onSelect={() =>
                s.callout ? chain().updateAttributes("callout", { tone }).run() : chain().wrapIn("callout", { tone }).run()
              }
            >
              <span className={cn("ml-1 mr-1 size-2 rounded-full", TONE_DOT[tone])} aria-hidden />
              {TONE_LABEL[tone]}
            </DropdownMenuItem>
          ))}
          {s.callout ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().lift("callout").run()}>Remove callout</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <Tooltip label="Table">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Table"
              aria-pressed={s.table}
              className={cn(s.table && "bg-selected text-fg")}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Table2 />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          {s.table ? (
            <>
              <DropdownMenuItem onSelect={() => chain().addRowAfter().run()}>Add row below</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().addColumnAfter().run()}>Add column right</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().deleteRow().run()}>Delete row</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().deleteColumn().run()}>Delete column</DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => chain().deleteTable().run()}>
                Delete table
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              Insert a 3 by 3 table
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton label="Divider" onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </ToolButton>
    </div>
  );
}

function LinkButton({ editor, active, shortcut }: { editor: Editor; active: boolean; shortcut: string }) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && editor.isFocused) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editor]);

  React.useEffect(() => {
    if (open) {
      setValue((editor.getAttributes("link").href as string | undefined) ?? "");
      setError(null);
    }
  }, [open, editor]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }
    const href = normaliseHref(value);
    if (!href) return setError("Use a web address, an email address or a path that starts with /.");
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !active) {
      chain.insertContent({ type: "text", text: value.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip label="Link" shortcut={shortcut}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Link"
            aria-pressed={active}
            className={cn(active && "bg-selected text-fg")}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Link2 />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-[320px] p-3">
        <form onSubmit={apply} className="flex flex-col gap-2">
          <label htmlFor="link-href" className="text-small font-medium text-fg">
            Link to
          </label>
          <Input
            id="link-href"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://… or /knowledge/it/vpn"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "link-error" : undefined}
          />
          {error ? (
            <p id="link-error" className="text-small text-danger-text">
              {error}
            </p>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            {active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove link
              </Button>
            ) : null}
            <Button type="submit" size="sm">
              {active ? "Update" : "Add link"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
