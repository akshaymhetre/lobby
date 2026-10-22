export type SearchResultType = "page" | "person" | "app" | "request_type" | "ticket" | "post";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  /** Plain text with matches wrapped in [[ and ]]. */
  snippet: string;
  url: string;
  freshness: number;
}

/** Display order and labels for result groups. */
export const RESULT_GROUPS: { type: SearchResultType; label: string; singular: string }[] = [
  { type: "page", label: "Pages", singular: "Page" },
  { type: "person", label: "People", singular: "Person" },
  { type: "app", label: "Apps", singular: "App" },
  { type: "request_type", label: "Help topics", singular: "Help topic" },
  { type: "ticket", label: "Tickets", singular: "Ticket" },
  { type: "post", label: "News", singular: "News" },
];
