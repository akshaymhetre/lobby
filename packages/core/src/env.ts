/** Runtime configuration read from the environment. Everything else lives in the database. */
export const env = {
  /** Public URL browsers use to reach Lobby, without trailing slash. */
  url: (process.env.LOBBY_URL ?? "http://localhost:4100").replace(/\/$/, ""),
  /** 32+ random bytes; encrypts secrets at rest and signs tokens. */
  secret: process.env.LOBBY_SECRET ?? "",
  smtpUrl: process.env.SMTP_URL ?? "",
  mailFrom: process.env.MAIL_FROM ?? "Lobby <lobby@localhost>",
  /** Dev-only impersonation login, refused in production. */
  devLogin: process.env.LOBBY_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",
  /** Optional bootstrap of the identity provider, so a deploy can be configured without the wizard. */
  oidc: {
    issuer: process.env.OIDC_ISSUER ?? "",
    clientId: process.env.OIDC_CLIENT_ID ?? "",
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
    discoveryUrl: process.env.OIDC_DISCOVERY_URL ?? "",
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  /** One-time token required to create the first admin on a non-localhost install (written by deploy/setup.sh). */
  setupToken: process.env.LOBBY_SETUP_TOKEN ?? "",
};

export function requireSecret(): string {
  if (env.secret.length >= 32) return env.secret;
  if (env.isProd) throw new Error("LOBBY_SECRET must be set to at least 32 characters (run deploy/setup.sh)");
  return "lobby-development-secret-do-not-use-in-production";
}
