# Security policy

Lobby handles sign-in, personal data and company documents, so security reports matter.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub:
open the repository's **Security** tab and choose **Report a vulnerability**.
Do not open a public issue.

Include what you found, the steps to reproduce it, and the version or commit you tested.
You will get an acknowledgement within a few days.

## Supported versions

Lobby is young and has no long-term support branches yet.
Fixes land on the `main` branch, so keep your install up to date (see [Upgrades](docs/install.md#upgrades)).

## Hardening your install

- Complete the setup wizard immediately after the first start, because the first person to finish its first step becomes the break-glass administrator.
- Keep `deploy/.env` private and backed up. `LOBBY_SECRET` encrypts the identity-provider and AI keys stored in the database.
- Serve Lobby only over HTTPS. The bundled Caddy does this for you.
- Never use the demo identity provider or the demo passwords for a real company.
