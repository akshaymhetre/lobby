# Lobby architecture

Lobby is a self-hostable employee intranet: SSO sign-in, an app launcher, people directory, knowledge base, helpdesk, onboarding journeys and an AI assistant.
This document is the contract every module builds against.

## Stack

- TypeScript everywhere, pnpm workspaces, turbo.
- `apps/web`: Next.js 16 (App Router, React 19, server components, server actions), Tailwind CSS v4.
- `apps/worker`: pg-boss worker process for background jobs.
- PostgreSQL 17 with pgvector and pg_trgm; Drizzle ORM (`casing: "snake_case"`, camelCase in TypeScript).
- Identity: Lobby is an OIDC relying party to the company's IdP. It never stores employee passwords.

## Layout

```
apps/web/src/
  app/(auth)/            sign-in, signed-out
  app/(app)/             everything behind sign-in, rendered inside the shell
  app/setup/             first-run wizard
  app/auth/              OIDC login, callback, logout, break-glass and dev login
  app/api/               route handlers (SCIM, webhooks, streaming)
  components/ui/         design-system primitives (see design/KERNEL.md, design/tokens.md)
  components/shell/      app shell, notifications, command palette, assistant panel
  components/<module>/   module-specific components
  server/                server-only helpers (auth, nav counts)
  lib/                   client-safe helpers (cn, nav model, time formatting)
apps/worker/src/handlers/<module>.ts   background handlers per module
packages/db/src/schema/<module>.ts     tables per module
packages/db/src/seed/<module>.ts       demo data per module
packages/core/src/<module>/            domain logic per module (no React)
packages/ai/                           LLM provider, retrieval, tools
packages/connectors/                   ticket connectors (Jira Service Management, webhook)
packages/config/                       configuration as code (YAML export/import)
deploy/                                docker compose, demo IdP realm, demo apps, setup script
```

## Conventions

- Domain logic lives in `packages/core/src/<module>/` and takes a `UserContext` for permission checks; pages and server actions stay thin.
- Server actions live next to their route in `_actions.ts` and always start with `await requireUser()` (or `requireRole`/`requireAdmin`) from `@/server/auth`.
- Never trust ids from the client: re-check that the acting user may see or change the row.
- Permissions: `ctx.has("admin" | "agent" | "content-editor" | "manager")`; audience lists of group ids use `inAudience(ctx, ids)`; search uses `ctx.principals`.
- Write an audit entry (`audit(actorId, "module.thing_done", target, data)`) for every admin change and every AI action.
- Long-running or retryable work goes through `enqueue(QUEUES.x, data)` from `@lobby/core/jobs`; handlers live in `apps/worker/src/handlers/<module>.ts`.
- Notifications: `notify(userId, { kind, title, body, href, email })` from `@lobby/core`.
- Dates: `date` columns are `YYYY-MM-DD` strings; timestamps are `Date` with time zone.
- UI: only `components/ui` primitives and design tokens (`bg-surface`, `text-muted`, `border-border`, `bg-accent`, ...). No raw hex colours, no new fonts, no emoji icons. Every list has a designed empty state. Every page uses `<Page>` and `<PageHeader>`.
- Copy: plain, warm and specific. Sentence case. No "Welcome to your dashboard".

## Shared seams

These files are imported almost everywhere. Keep changes to them small and call them out in your pull request.


- `apps/web/src/lib/nav.ts`: the navigation model.
- `apps/web/src/app/(app)/layout.tsx` and `components/shell/app-shell.tsx`.
- `packages/db/src/schema/core.ts`, `packages/db/src/seed/base.ts`, `packages/db/src/seed/index.ts`.
- `packages/core/src/identity/*`, `packages/core/src/search/*`, `packages/core/src/jobs.ts`.
- Open the command palette or the assistant from anywhere with `openCommandPalette()` / `openAssistant(prompt)` from `components/shell/shell-events`.

## Search

- `upsertSource(type, id, chunks, acl, freshness)` and `removeSource(type, id)` from `@lobby/core/search` write the index.
- `search({ principals, query, types, limit })` returns ACL-filtered hits fused from full-text, prefix and trigram matches; snippets mark matches with `[[` and `]]`.
- ACL principals: `"*"` (everyone), `"group:<uuid>"`, `"user:<uuid>"`. Use `aclForGroups(groupIds)`.

## Local development

```
cd deploy && docker compose --profile demo-idp --profile demo-apps up -d   # Postgres, Keycloak, Grafana, Expenses, Mailpit
pnpm db:reset                                                              # schema + demo company
pnpm --filter @lobby/web dev                                               # http://localhost:4100
pnpm --filter @lobby/worker dev
```

- Demo IdP (Keycloak): http://localhost:4180, realm `northwind`, every demo user's password is `northwind` (e.g. `maya.chen`).
- Break-glass admin: `admin@northwind.example` / `lobby-demo-admin`.
- Development-only impersonation: `http://localhost:4100/auth/dev-login?email=<email>&returnTo=/path` (requires `LOBBY_DEV_LOGIN=1`, refused in production).
- Mailpit (caught email): http://localhost:4125.
- Re-seed one module without touching others: `pnpm --filter @lobby/db seed:one <apps|home|knowledge|helpdesk|journeys>`.
- Apply schema changes: `pnpm db:push`.

Demo personas: Maya Chen (engineer), Grace Okoye (engineering manager), Sam Okafor (engineer starting tomorrow), Alex Morgan (Head of IT, admin and helpdesk agent), Priya Raman (People partner, helpdesk agent), Amara Nwosu (Chief People Officer).

## Cross-module contracts

Modules are built in parallel, so these signatures are fixed up front.
The owning module implements them; callers import them and must tolerate the module not being installed yet (wrap in try/catch and degrade gracefully).

| Function | Module (file) | Purpose |
|---|---|---|
| `createTicket(ctx, { requestTypeSlug, subject, description?, fields?, priority?, source?, onBehalfOfUserId? }) => Promise<{ id, number }>` | helpdesk (`packages/core/src/helpdesk/index.ts`) | Used by the app launcher (access requests), journeys (auto-created tickets) and the AI assistant. Applies routing, SLA and approvals. |
| `listMyTickets(ctx, { open?: boolean, limit? })` | helpdesk | Home "Today" strip, AI assistant. |
| `installStarterCatalog()` | helpdesk | Setup wizard "starter content" step. Idempotent. |
| `getPageBySlug(ctx, spaceSlug, pageSlug)`, `acknowledgePage(ctx, pageId)`, `hasAcknowledged(userId, pageId)` | knowledge (`packages/core/src/knowledge/index.ts`) | Journeys read/acknowledge steps. |
| `installStarterContent()` | knowledge | Setup wizard. Idempotent. |
| `APP_PRESETS`, `createAppFromPreset(ctx, presetKey, { groupIds })`, `listVisibleApps(ctx)` | apps (`packages/core/src/apps/index.ts`) | Setup wizard apps step, AI assistant `find_app`. |
| `myOpenSteps(ctx)`, `completeStep(ctx, stepRunId)`, `startJourneyFor(userId, journeyId?)` | journeys (`packages/core/src/journeys/index.ts`) | Home "Today" strip, AI assistant. |
| `installStarterJourneys()` | journeys | Setup wizard. Idempotent. |
| `findPeople(ctx, query, limit)` | people (`packages/core/src/people/index.ts`) | AI assistant `find_person`. |
| `index<Source>(id)` and `reindex<Source>s()` | each module (`packages/core/src/<module>/index-source.ts`) | Search indexing; the integrator wires them into the reindex job. |

Fixed demo slugs, so seeds can reference each other:
- Knowledge spaces: `company`, `people`, `it`, `engineering`, `finance`, `workplace`, `people-confidential` (visible to the `people-team` group only).
- Knowledge pages (space/page): `company/welcome-to-northwind`, `company/mission-and-values`, `people/employee-handbook`, `people/code-of-conduct`, `people/holiday-policy`, `people/parental-leave`, `it/security-policy`, `it/laptop-setup`, `it/password-and-mfa`, `it/vpn`, `engineering/dev-environment`, `engineering/on-call`, `finance/expenses-policy`, `workplace/london-office`.
- Helpdesk teams: `it`, `people`, `workplace`, `finance`. Request types: `new-laptop`, `app-access`, `password-mfa-reset`, `vpn-issue`, `hardware-problem`, `software-request`, `payroll-question`, `leave-question`, `update-personal-details`, `building-access`, `desk-booking`, `expense-question`, `onboarding-equipment`, `offboarding-return`, `something-else`.
- Apps: `google-workspace`, `slack`, `github`, `jira`, `notion`, `figma`, `grafana`, `expenses`, `bamboohr`, `salesforce`, `zoom`, `1password`, `linear`.

## Deployment

Installing and running Lobby in production is covered in [docs/install.md](install.md); configuration in [docs/configuration.md](configuration.md); the demo company in [docs/demo.md](demo.md).
