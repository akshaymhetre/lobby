/** Human sentences for audit actions. Unknown actions fall back to a tidied version of the key. */
const LABELS: Record<string, string> = {
  "auth.signed_in": "Signed in",
  "setup.admin_created": "Created the administrator account",
  "setup.apps_added": "Added apps during setup",
  "setup.starter_content_installed": "Installed starter content",
  "branding.updated": "Updated company branding",
  "identity.updated": "Changed single sign-on settings",
  "roles.mappings_updated": "Changed role mappings",
  "scim.token_created": "Generated a SCIM token",
  "scim.token_revoked": "Revoked a SCIM token",
  "ai.settings_updated": "Changed AI assistant settings",
  "config.imported": "Imported a configuration file",
  "config.exported": "Downloaded the configuration",
  "upload.created": "Uploaded an image",
  "scim.user_created": "SCIM created a person",
  "scim.user_patched": "SCIM updated a person",
  "scim.user_updated": "SCIM updated a person",
  "scim.user_deleted": "SCIM removed a person",
  "scim.group_created": "SCIM created a group",
  "scim.group_patched": "SCIM updated a group",
  "scim.group_updated": "SCIM updated a group",
  "scim.group_deleted": "SCIM removed a group",
  "helpdesk.ticket_created": "Raised a request",
  "helpdesk.approval_approved": "Approved a request",
  "helpdesk.approval_rejected": "Rejected a request",
};

const ACRONYMS: Record<string, string> = { scim: "SCIM", ai: "AI", it: "IT", sla: "SLA", csv: "CSV", sso: "SSO", oidc: "OIDC" };

export function describeAudit(action: string, data?: Record<string, unknown> | null): string {
  const base = LABELS[action];
  if (base) {
    if (action === "scim.token_created" || action === "scim.token_revoked") {
      return typeof data?.name === "string" ? `${base}: ${data.name}` : base;
    }
    return base;
  }
  const [area = "", ...rest] = action.split(".");
  const verb = rest.join(" ").replace(/_/g, " ").replace(/\b\w+\b/g, (w) => ACRONYMS[w] ?? w);
  const label = ACRONYMS[area] ?? area.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return verb ? `${label}: ${verb}` : label;
}
