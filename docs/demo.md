# The Lobby demo

The demo runs Lobby for a fictional company, Northwind Labs, with everything a real install has: its own identity provider, two apps that sign in through it, 40 people, a knowledge base, a helpdesk and an onboarding journey in progress.
Nothing in it is real, and every email it sends is caught on your machine.

## Start it

You need Docker with Compose 2.24 or newer, and the ports 4100, 4125, 4130, 4132, 4140 and 4180 free on your computer.

1. Write the demo settings:
   ```sh
   ./deploy/setup.sh --demo
   ```
   Expected output ends with `Open http://localhost:4100 and sign in with the demo identity provider`.
2. Start everything:
   ```sh
   cd deploy
   docker compose up -d
   ```
   The first start builds the Lobby images, which takes a few minutes.
3. Check that it is ready:
   ```sh
   docker compose ps -a
   ```
   Expected output: `web`, `postgres` and `keycloak` show `healthy`, and `seed-demo` shows `Exited (0)`.
   If `seed-demo` exited with another code, read why with `docker compose logs seed-demo`.

If you also develop Lobby on this computer, stop the development containers first, because the demo uses the same ports.

## What runs where

| What | Address | Sign in as |
|---|---|---|
| Lobby | http://localhost:4100 | any person below, password `northwind` |
| Demo identity provider (Keycloak) | http://localhost:4180 | admin console: `admin` and the `KEYCLOAK_ADMIN_PASSWORD` from `deploy/.env` |
| Grafana (demo app) | http://localhost:4130 | through single sign-on |
| Expenses (demo app) | http://localhost:4140 | through single sign-on |
| Mailpit (caught email) | http://localhost:4125 | no sign-in |

The demo identity provider and its apps only answer on `localhost`, so the demo is meant for one computer, not a shared server.

## The people

Every demo person's password is `northwind`.
Sign in with the part of their email before the `@`, for example `maya.chen`.

| Person | Username | Role in the story |
|---|---|---|
| Maya Chen | `maya.chen` | Senior Software Engineer. An everyday employee; start here. Her manager is Nikolai Petrov. |
| Nikolai Petrov | `nikolai.petrov` | Engineering Manager, Platform. Approves Maya's requests. |
| Grace Okoye | `grace.okoye` | Engineering Manager, Product. Manager of Sam Okafor. |
| Sam Okafor | `sam.okafor` | Software Engineer who starts tomorrow, with an onboarding journey under way. |
| Alex Morgan | `alex.morgan` | Head of IT. Lobby admin and IT helpdesk agent. |
| Priya Raman | `priya.raman` | People Partner. People helpdesk agent and content editor. |
| Amara Nwosu | `amara.nwosu` | Chief People Officer. Content editor for the People pages. |

There is also a break-glass administrator that does not go through the identity provider: `admin@northwind.example` with the password `lobby-demo-admin`.
Use it from the sign-in page's administrator option.

## A five-minute tour

Use a private browser window for each person you switch to, or sign out in between.
Signing out of Lobby also signs you out of the demo identity provider.

### 1. Sign in once (Maya)

1. Open http://localhost:4100 and choose to sign in.
2. Sign in as `maya.chen` with the password `northwind`.

You land on Maya's home page, with her apps and what needs her attention today.

### 2. Open an app without signing in again

1. Find **Grafana** in the app launcher and open it.

Grafana opens and Maya is already signed in.
There is no second login, because Grafana trusts the same identity provider and Maya's session is already there.
This is what Lobby's launcher does for every app your company connects to its identity provider.

### 3. Ask for access to an app

1. Back in Lobby, open **Apps** and pick an app Maya does not have yet, which offers **Request access**.
2. Say why she needs it, and send the request.

Lobby raises a helpdesk ticket for it.
Access requests need two approvals: Maya's manager first, then the IT team.

### 4. Approve it (Nikolai, then Alex)

1. In a new private window, sign in as `nikolai.petrov`.
2. Open the approval waiting for him, from his home page or notifications, and approve it.
3. In another private window, sign in as `alex.morgan` and approve the IT step the same way.

Maya gets a notification at each step, and the emails Lobby sends land in Mailpit at http://localhost:4125.

### 5. Follow a new starter (Grace)

1. Sign in as `grace.okoye`.
2. Open Sam Okafor's onboarding journey.

Sam starts tomorrow.
His journey already has pages for him to read, tickets raised for his laptop and accounts, and steps for Grace as his manager.
Each step shows who it belongs to and when it is due.

### 6. Ask the assistant

1. Open the assistant from the top bar.
2. Ask: "How do I get onto the VPN?"

The assistant answers from Northwind's own knowledge base, links to the pages it used, and never uses anything the person asking cannot see.
It writes full answers when an Anthropic API key is set (`ANTHROPIC_API_KEY` in `deploy/.env`, or under Admin, AI, signed in as `alex.morgan`).
Without a key it still finds the right pages, people and apps.

## Reset the demo

To start again from a clean company, remove the demo's containers and data, then start it again:

```sh
cd deploy
docker compose down -v
docker compose up -d
```

`down -v` deletes the demo database, so only do this on the demo.
