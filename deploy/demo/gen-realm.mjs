// Generates deploy/keycloak/realm-northwind.json from deploy/demo/people.json.
// Demo only: every user's password is "northwind". Run: node deploy/demo/gen-realm.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const people = JSON.parse(readFileSync(join(here, "people.json"), "utf8"));
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const username = (p) => `${slug(p.first)}.${slug(p.last)}`;

const groups = [...new Set(people.flatMap((p) => p.groups))].sort();

const groupsMapper = {
  name: "groups",
  protocol: "openid-connect",
  protocolMapper: "oidc-group-membership-mapper",
  config: {
    "full.path": "false",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "userinfo.token.claim": "true",
    "claim.name": "groups",
  },
};

const client = (clientId, name, rootUrl, redirectUris, secret) => ({
  clientId,
  name,
  enabled: true,
  protocol: "openid-connect",
  publicClient: false,
  secret,
  rootUrl,
  baseUrl: rootUrl,
  redirectUris,
  webOrigins: [rootUrl],
  standardFlowEnabled: true,
  directAccessGrantsEnabled: false,
  attributes: { "post.logout.redirect.uris": `${rootUrl}/*` },
  protocolMappers: [groupsMapper],
});

const realm = {
  realm: "northwind",
  displayName: "Northwind Labs",
  enabled: true,
  sslRequired: "none",
  loginWithEmailAllowed: true,
  duplicateEmailsAllowed: false,
  rememberMe: true,
  ssoSessionIdleTimeout: 36000,
  ssoSessionMaxLifespan: 86400,
  groups: groups.map((name) => ({ name, path: `/${name}` })),
  clients: [
    client("lobby", "Lobby", process.env.LOBBY_URL ?? "http://localhost:4100",
      [`${process.env.LOBBY_URL ?? "http://localhost:4100"}/*`], "lobby-demo-secret"),
    client("grafana", "Grafana", "http://localhost:4130", ["http://localhost:4130/*"], "grafana-demo-secret"),
    client("expenses", "Expenses", "http://localhost:4140", ["http://localhost:4140/oauth2/callback"], "expenses-demo-secret"),
  ],
  users: people.map((p) => ({
    username: username(p),
    email: `${username(p)}@northwind.example`,
    emailVerified: true,
    firstName: p.first,
    lastName: p.last,
    enabled: true,
    credentials: [{ type: "password", value: "northwind", temporary: false }],
    groups: p.groups.map((g) => `/${g}`),
  })),
};

writeFileSync(join(here, "..", "keycloak", "realm-northwind.json"), JSON.stringify(realm, null, 2) + "\n");
console.log(`wrote realm with ${realm.users.length} users, ${groups.length} groups`);
