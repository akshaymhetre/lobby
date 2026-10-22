# Configuring Lobby

Lobby keeps almost all of its configuration in its database, where admins change it in the browser.
Only a handful of things live in environment variables: the address, the secrets, email and an optional identity provider and AI key for unattended installs.

## Environment variables

With Docker, these live in `deploy/.env`.
`deploy/setup.sh` writes that file for you from `deploy/.env.example`, which explains every variable in place.
After editing it, run `docker compose up -d` from the `deploy` folder to apply the change.

### Read by Lobby

| Variable | Required | What it does |
|---|---|---|
| `LOBBY_URL` | Yes | The address people type, without a trailing slash, for example `https://lobby.example.com`. Sign-in redirects, email links and the SCIM base URL are all built from it. |
| `LOBBY_SECRET` | Yes | At least 32 random characters. Encrypts the secrets Lobby stores (identity provider and AI keys) and signs session tokens. Lobby refuses to start in production without it. |
| `DATABASE_URL` | Yes | Postgres connection string. Compose builds it for you from `POSTGRES_PASSWORD`. |
| `SMTP_URL` | No | Outgoing mail server, for example `smtp://user:password@smtp.example.com:587`. Empty means email is written to the worker log instead. |
| `MAIL_FROM` | No | The sender of Lobby's email, for example `Lobby <lobby@example.com>`. |
| `OIDC_ISSUER` | No | Identity provider issuer URL, to configure sign-in without the wizard. |
| `OIDC_CLIENT_ID` | No | Client ID registered for Lobby at the identity provider. |
| `OIDC_CLIENT_SECRET` | No | The matching client secret. |
| `OIDC_DISCOVERY_URL` | No | Only when Lobby must reach the provider at a different address than browsers do, such as a provider in the same Docker network. |
| `ANTHROPIC_API_KEY` | No | API key for the AI assistant. A key saved under Admin, AI takes priority. |
| `LOBBY_DATA_DIR` | No | Where uploaded images are stored. The containers set it to `/data`, which is the `lobby-data` volume. |

Identity settings saved in the setup wizard always take priority over the `OIDC_*` variables.
The variables are a starting point for installs that are configured by automation rather than by a person.

### Read by Docker Compose

| Variable | What it does |
|---|---|
| `COMPOSE_PROFILES` | Which groups of services run. `app` for a real install; `app,demo-idp,demo-apps,demo-seed` for the demo. |
| `LOBBY_SITE_ADDRESS` | What Caddy answers on: your domain (Caddy then gets an HTTPS certificate on its own), or `:80` for plain HTTP. |
| `LOBBY_BIND_ADDRESS` | The network interface Caddy publishes on: `0.0.0.0` for everyone, `127.0.0.1` for this computer only. |
| `LOBBY_HTTP_PORT`, `LOBBY_HTTPS_PORT` | The ports Caddy publishes on this machine. |
| `POSTGRES_PASSWORD` | Password for the bundled Postgres. Applied only when its volume is first created. |
| `POSTGRES_PORT` | Postgres is published on this port on `127.0.0.1`, for backups and admin tools. |
| `KEYCLOAK_ADMIN_PASSWORD` | Admin console password for the demo identity provider. |
| `DEMO_OIDC_DISCOVERY_URL` | How the demo seed tells Lobby to reach the demo identity provider inside Docker. |

### Set inside the images

You rarely need these, but they are there when you do.

| Variable | Default | What it does |
|---|---|---|
| `LOBBY_SKIP_MIGRATIONS` | unset | Set to `1` to skip the database migration step at container start, for example when you run migrations as a separate deploy step. |
| `LOBBY_MIGRATIONS_DIR` | `/opt/lobby/migrations` | Where the migration files live inside the image. |
| `LOBBY_DB_WAIT_SECONDS` | `60` | How long a starting container waits for Postgres before giving up. |
| `LOBBY_DB_EXTENSIONS` | `vector,pg_trgm` | Postgres extensions created before migrating. With a managed Postgres where Lobby's user cannot create extensions, have an administrator run `create extension vector; create extension pg_trgm;` once. |
| `LOBBY_HEALTH_PATH` | `/sign-in` | The page the container health check requests. |

## Using your own Postgres

Lobby needs PostgreSQL 17 with the `pgvector` and `pg_trgm` extensions.
To use a database you already run, point `DATABASE_URL` at it in the `x-lobby-env` block of `deploy/docker-compose.yml`, and remove the `postgres` service from the `depends_on` of `web`, `worker` and `seed-demo`.
Start from an empty database: Lobby creates its own tables the first time it starts.

## Configuration as code

Company details and branding, groups, role mappings, apps, knowledge spaces, the helpdesk (teams, request types, SLA policies and business calendars) and onboarding journeys can be exported to a YAML file, kept in version control and applied back.
This is how you copy a configuration from a test install to production, or review changes before they go live.

From a checkout of Lobby on a machine that can reach the database, with `DATABASE_URL` and `LOBBY_SECRET` set to the same values as the install:

1. Export the current configuration:
   ```sh
   pnpm --filter @lobby/config exec tsx src/cli.ts export > lobby.yaml
   ```
   Expected output: nothing on screen, and a `lobby.yaml` file in the current folder.
   An empty file means the export failed; run the command without `> lobby.yaml` to see the error.
2. Edit `lobby.yaml`.
3. Preview what would change, without writing anything:
   ```sh
   pnpm --filter @lobby/config exec tsx src/cli.ts apply lobby.yaml --dry-run
   ```
   Expected output: one line per section, such as `Apps: 1 to create, 0 to update, 12 unchanged`, then `Dry run: nothing was written.`
4. Apply it:
   ```sh
   pnpm --filter @lobby/config exec tsx src/cli.ts apply lobby.yaml
   ```
   Expected output: the same summary, then `Applied.`

If the file has a mistake, the command prints `error:` lines, changes nothing and exits with code 1.
Every applied change is recorded in the audit log.

On a Docker install, the same tool is inside the worker container, so you do not need a checkout.
Run these from the `deploy` folder:

```sh
docker compose exec -T worker node --import tsx ../../packages/config/src/cli.ts export > lobby.yaml
docker compose exec -T worker node --import tsx ../../packages/config/src/cli.ts apply /dev/stdin --dry-run < lobby.yaml
docker compose exec -T worker node --import tsx ../../packages/config/src/cli.ts apply /dev/stdin < lobby.yaml
```

## Roles

Everyone who signs in is an employee.
Lobby adds more roles based on the groups your identity provider sends:

| Role | What it allows |
|---|---|
| `admin` | Everything under Admin: company settings, identity, apps, roles, AI and the audit log. Admins also get the `agent` and `content-editor` roles. |
| `agent` | Working helpdesk tickets in the agent queue. |
| `content-editor` | Creating and editing knowledge pages. |
| `manager` | Not mapped from groups. Anyone with direct reports in the org chart is a manager and can approve their team's requests. |

To map a group to a role, open Admin, Roles, and add the group name exactly as your identity provider sends it in the groups claim, for example `lobby-admins` to `admin`.
Group names are matched exactly, including case.
A changed role mapping applies on each person's next page load.
A person's group memberships update when they sign in, or straight away when SCIM provisioning is on.

Your identity provider must include a `groups` claim in the ID token for role mapping to work.
Each identity guide explains how to turn it on.
If your provider uses a different claim name, set it in Admin, Identity.

The break-glass administrator created by the setup wizard is always an admin, whatever the groups say.
Keep its password safe: it is the way back in if the identity provider is down or misconfigured.

## AI assistant

The assistant answers questions from your company's knowledge, people and helpdesk, and only uses what the person asking is allowed to see.

Configure it under Admin, AI:

- **On or off.** The assistant is off until an admin turns it on.
- **API key.** An Anthropic API key, stored encrypted with `LOBBY_SECRET`.
  If none is saved there, Lobby uses `ANTHROPIC_API_KEY` from the environment.
- **Model.** Which model answers.
  The test button sends a tiny request to prove the key and model work.
- **Retention.** How many days conversations are kept, 90 by default.

Without an API key, the assistant still finds relevant pages, people and apps through search, but does not write answers.
Every action the assistant takes on someone's behalf, such as raising a ticket, is written to the audit log.
