"use client";

/**
 * Tiny event bus so any component can open the global command palette or the AI assistant
 * without importing them. The palette and the assistant panel listen for these events.
 */
export const SHELL_EVENTS = {
  openPalette: "lobby:open-palette",
  openAssistant: "lobby:open-assistant",
  /** Fired by the assistant panel with { open } whenever it opens or closes. */
  assistantState: "lobby:assistant-state",
} as const;

export function openCommandPalette(query?: string) {
  window.dispatchEvent(new CustomEvent(SHELL_EVENTS.openPalette, { detail: { query } }));
}

/** Opens the assistant panel, optionally starting a conversation with `prompt`. */
export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(SHELL_EVENTS.openAssistant, { detail: { prompt } }));
}
