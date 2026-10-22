"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Undo2,
} from "lucide-react";
import { normaliseHref } from "@/components/knowledge/editor/toolbar";
import "@/components/knowledge/editor/editor.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <Button
        type="button"
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

function LinkTool({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const [href, setHref] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const active = editor.isActive("link");
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setHref((editor.getAttributes("link").href as string | undefined) ?? "");
          setError(null);
        }
      }}
    >
      <Tooltip label="Link">
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" aria-pressed={active} className={cn(active && "bg-selected text-fg")}>
            <Link2 />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-[320px] p-3">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!href.trim()) {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              setOpen(false);
              return;
            }
            const safe = normaliseHref(href);
            if (!safe) {
              setError("Use a web address, an email or a page path like /help.");
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
            setOpen(false);
          }}
        >
          <label htmlFor="post-link" className="text-small font-medium text-fg">
            Link to
          </label>
          <Input id="post-link" value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://... or /knowledge/..." autoFocus />
          {error ? <p className="text-small text-danger-text">{error}</p> : null}
          <div className="flex justify-end gap-2">
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
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const sep = <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="cell sticky top-14 z-10 -mx-1 flex items-center gap-0.5 overflow-x-auto rounded-cell px-1 py-1 [scrollbar-width:none]"
    >
      <Tool label="Heading" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </Tool>
      <Tool label="Subheading" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </Tool>
      {sep}
      <Tool label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
        <Bold />
      </Tool>
      <Tool label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
        <Italic />
      </Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
        <Strikethrough />
      </Tool>
      <LinkTool editor={editor} />
      {sep}
      <Tool label="Bulleted list" active={s.ul} onClick={() => c().toggleBulletList().run()}>
        <List />
      </Tool>
      <Tool label="Numbered list" active={s.ol} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered />
      </Tool>
      <Tool label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
        <Quote />
      </Tool>
      <Tool label="Divider" onClick={() => c().setHorizontalRule().run()}>
        <Minus />
      </Tool>
      <span className="ml-auto" />
      <Tool label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>
        <Undo2 />
      </Tool>
      <Tool label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>
        <Redo2 />
      </Tool>
    </div>
  );
}

/** Rich text for news posts. Emits HTML; the server sanitizes it before storing. */
export function RichTextEditor({
  initialHtml,
  onChange,
  invalid,
  describedBy,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => !!normaliseHref(url),
          HTMLAttributes: { rel: "noopener noreferrer", target: null },
        },
      }),
      Placeholder.configure({ placeholder: "Write your post. Use headings to break up longer updates." }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        "aria-label": "Post body",
        role: "textbox",
        "aria-multiline": "true",
        ...(invalid ? { "aria-invalid": "true" } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  return (
    <div className="flex flex-col gap-3">
      {editor ? <Toolbar editor={editor} /> : <div className="cell h-10 rounded-cell" aria-hidden />}
      <div className={cn("lobby-editor [&_.ProseMirror]:!min-h-[200px] [&_.ProseMirror]:!pb-6 md:[&_.ProseMirror]:!min-h-[320px]", invalid && "rounded-control ring-2 ring-danger/40")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
