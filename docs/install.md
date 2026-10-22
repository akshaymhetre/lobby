# Install Lobby on your own server

This guide puts Lobby on a single Linux machine, served over HTTPS on your own domain.
Plan for about 20 minutes: 10 for the machine and DNS, 10 for the setup wizard.

## What you need

- A Linux virtual machine with 2 CPUs, 4 GB of memory and 20 GB of disk.
  This comfortably serves a company of a few hundred people.
- Docker Engine 24 or newer with the Compose plugin 2.24 or newer.
- A domain name for Lobby, for example `lobby.example.com`, and access to its DNS.
- Ports 80 and 443 open to the people who will use Lobby.
  Port 80 is needed for the HTTPS certificate, even if everyone uses HTTPS.
- Administrator access to your identity provider (Okta, Microsoft Entra ID, Google Workspace, Keycloak, authentik or another OIDC provider).
- Optional: SMTP details for sending email, and an Anthropic API key for the AI assistant.

Lobby stores everything in its own Postgres database, which runs in a container next to it.

## 1. Point DNS at the machine

Create an `A` record (and an `AAAA` record if the machine has IPv6) for your Lobby domain, pointing at the machine's public address.

Check it from your laptop:

```sh
dig +short lobby.example.com
```

Expected output: the machine's public IP address.
If the result is empty, wait a few minutes for DNS to update and try again.

## 2. Get Lobby onto the machine

```sh
git clone https://github.com/akshaymhetre/lobby.git
cd lobby
```

## 3. Run the setup script

```sh
./deploy/setup.sh --blank --url https://lobby.example.com
```

Expected output ends with:

```
Wrote deploy/.env for a blank install at https://lobby.example.com
  Generated strong random values for LOBBY_SECRET, POSTGRES_PASSWORD and KEYCLOAK_ADMIN_PASSWORD.
```

The script checks your Docker and Compose versions, then writes `deploy/.env` with strong random secrets.
Run it without flags to answer the questions interactively instead.
It never overwrites an existing `deploy/.env` unless you pass `--force`, and even then it keeps your secrets.

Copy `deploy/.env` somewhere safe, such as your password manager.
`LOBBY_SECRET` encrypts the identity provider and AI keys stored in the database, so a database backup is only useful together with it.

## 4. Start Lobby

```sh
cd deploy
docker compose up -d
```

The first start builds the Lobby images, which takes a few minutes.
Then check the services:

```sh
docker compose ps
```

Expected output: `postgres` and `web` show `healthy`, and `worker` and `caddy` show `running`.
If `web` stays at `starting` for more than two minutes, read its log with `docker compose logs web`.

On first start, Caddy fetches an HTTPS certificate for your domain from Let's Encrypt.
If DNS or port 80 is not reachable yet, `docker compose logs caddy` says so, and Caddy keeps retrying on its own.

## 5. Finish the setup wizard

Open `https://lobby.example.com` in your browser.
Lobby sends you to the setup wizard.

Do this straight away.
The first person to complete the wizard's first step becomes the break-glass administrator, so do not leave a fresh install waiting on the open internet.

The wizard walks you through:

1. **Administrator.** Your name, email and a strong password.
   This account works even when your identity provider is down, so keep the password safe.
2. **Company.** Name, logo, accent colour, time zone and working days.
3. **Identity provider.** Register Lobby with your provider using the guide for it, paste in the issuer, client ID and secret, and test the sign-in.
   See [the identity guides](#identity-provider-guides).
4. **People.** Turn on SCIM provisioning so people and groups arrive from your identity provider, or import a CSV.
5. **Apps.** Pick the apps your company uses so they appear in the launcher.
6. **Content.** Optionally install starter pages, helpdesk request types and an onboarding journey.

## Identity provider guides

- [Okta](identity/okta.md)
- [Microsoft Entra ID](identity/entra-id.md)
- [Google Workspace](identity/google-workspace.md)
- [Keycloak](identity/keycloak.md)
- [authentik](identity/authentik.md)

Any other provider works if it speaks OpenID Connect.
Use the redirect URI `https://lobby.example.com/auth/callback` and the scopes `openid email profile`.

## Backups

Lobby keeps its data in two places, and you need both:

- The **Postgres database**, in the Docker volume `lobby_pgdata`.
- The **uploads**, such as your company logo and app icons, in the Docker volume `lobby_lobby-data`.

And one file:

- **`deploy/.env`**, because it holds `LOBBY_SECRET`.
  Back it up once, and again whenever you change it.

### Back up the database

Run this from the `deploy` folder, for example every night from cron:

```sh
docker compose exec -T postgres pg_dump -U lobby -d lobby --format=custom > lobby-$(date +%F).dump
```

Expected output: nothing on screen, and a new `lobby-YYYY-MM-DD.dump` file of a few megabytes or more.
An empty file means the command failed; run it again without `> ...` to see the error.

### Back up the uploads

```sh
docker run --rm -v lobby_lobby-data:/data:ro -v "$PWD":/backup alpine tar czf /backup/lobby-uploads-$(date +%F).tgz -C /data .
```

Expected output: a new `lobby-uploads-YYYY-MM-DD.tgz` file.

Copy both files off the machine, for example to object storage.

### Restore

1. Stop the Lobby containers, keeping Postgres running:
   ```sh
   docker compose stop web worker caddy
   ```
2. Restore the database into the running Postgres:
   ```sh
   docker compose exec -T postgres pg_restore -U lobby -d lobby --clean --if-exists < lobby-YYYY-MM-DD.dump
   ```
3. Restore the uploads:
   ```sh
   docker run --rm -v lobby_lobby-data:/data -v "$PWD":/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/lobby-uploads-YYYY-MM-DD.tgz -C /data"
   ```
4. Make sure `deploy/.env` has the same `LOBBY_SECRET` as when the backup was taken.
5. Start everything again:
   ```sh
   docker compose up -d
   ```

## Upgrades

1. Take a backup (see above).
2. Get the new version:
   ```sh
   cd lobby
   git pull
   ```
3. Rebuild and restart:
   ```sh
   cd deploy
   docker compose up -d --build
   ```
4. Check that `web` is `healthy` again with `docker compose ps`.

Database changes are applied automatically when the containers start.
Both the web and worker containers run the migrations before they start serving, under a database lock, so they never step on each other.
The log line `[migrate] database is up to date` in `docker compose logs web` confirms it.

## Useful commands

All of these run from the `deploy` folder.

| What | Command |
|---|---|
| See what is running | `docker compose ps` |
| Follow the logs | `docker compose logs -f web worker` |
| Restart Lobby | `docker compose restart web worker` |
| Stop everything | `docker compose down` (your data stays in the volumes) |
| Open a database shell | `docker compose exec postgres psql -U lobby -d lobby` |

`docker compose down -v` deletes the volumes, and with them all of your data.
Only use it on a test install.

## Running behind your own proxy or load balancer

If HTTPS is already handled in front of the machine, run setup with a plain `http://` address on port 80:

```sh
./deploy/setup.sh --blank --url http://lobby.example.com
```

Then edit `deploy/.env` so `LOBBY_URL` is the `https://` address people actually use, and forward your proxy to port 80 on the machine.
`LOBBY_URL` must always be the address in the browser, because every sign-in redirect is built from it.

## Trying Lobby on a laptop

For a local install on `http://localhost:4100`, run `./deploy/setup.sh` and accept the default address.
For the demo company, see [the demo guide](demo.md).

If you also develop Lobby on the same machine, stop the development containers first.
Both setups use the same Postgres port and database volume, and a database created by the development workflow (`pnpm db:reset`) cannot be used by the containers.
