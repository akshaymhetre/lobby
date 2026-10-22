import { Node, mergeAttributes } from "@tiptap/react";

export type CalloutTone = "info" | "warning" | "success" | "danger";
export const CALLOUT_TONES: CalloutTone[] = ["info", "warning", "success", "danger"];

/** A coloured note box (info, warning, success, danger). Stored as { type: "callout", attrs: { tone } }. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (el) => (CALLOUT_TONES.includes(el.getAttribute("data-tone") as CalloutTone) ? el.getAttribute("data-tone") : "info"),
        renderHTML: (attrs) => ({ "data-tone": attrs.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "" }), 0];
  },

});
