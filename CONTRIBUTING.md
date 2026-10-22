# Contributing to Lobby

Thanks for helping.
Bug reports, documentation fixes, identity-provider guides and pull requests are all welcome.

## Before you start

- For a bug, open an issue with the steps to reproduce it, what you expected and what happened.
  Screenshots help for anything visual.
- For a larger change or a new module, open an issue first so we can agree on the shape before you write the code.

## Set up

You need Node 24, pnpm 11 and Docker.

```sh
cd deploy && docker compose --profile demo-idp --profile demo-apps up -d && cd ..
pnpm install
pnpm db:reset
pnpm --filter @lobby/web dev        # http://localhost:4100
pnpm --filter @lobby/worker dev
```

Sign in as `maya.chen` with the password `northwind`.
The other demo people are listed in [docs/demo.md](docs/demo.md).

## Before you open a pull request

1. Run the checks and make sure they pass with no failures:
   ```sh
   pnpm check
   ```
2. If you changed a user flow, run the end-to-end tests against your running app:
   ```sh
   pnpm e2e
   ```
3. If you changed the database schema, generate a migration with `pnpm --filter @lobby/db generate` and commit it.
   Never edit a generated migration by hand.
4. If you changed the UI, check it in both the light and dark themes, and at desktop and phone widths.
   Include before and after screenshots in the pull request.

## Conventions

The full list is in [docs/architecture.md](docs/architecture.md).
The ones that matter most:

- Domain logic lives in `packages/core` and takes a `UserContext`; pages and server actions stay thin.
- Every server action starts by checking who is acting, and never trusts an id sent from the browser.
- Permissions are enforced in the query, so search and the AI assistant can never show something the person cannot open.
- Every admin change and every AI action writes an audit entry.
- UI uses the shared components and design tokens in `apps/web/src/components/ui`, not raw colours.
  Every list has a designed empty state.
- Copy is plain, specific and in sentence case.

## Reporting a security problem

Please do not open a public issue.
See [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contributions are licensed under the [MIT licence](LICENSE).
