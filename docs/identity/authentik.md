# Connect Lobby to authentik

This guide registers Lobby as an OpenID Connect application in authentik, sends group memberships to Lobby, turns on SCIM provisioning and makes your other apps open from the launcher without a second sign-in.
In the examples, Lobby lives at `https://lobby.example.com` and authentik at `https://auth.example.com`; use your own values instead.

authentik's admin interface changes between releases.
Where a menu name below might differ in your version, the step says so; look for the closest match.

## What you will need from this guide

| Lobby asks for | Where it comes from |
|---|---|
| Issuer | `https://auth.example.com/application/o/lobby/`, including the trailing slash |
| Client ID | The provider's **Client ID** |
| Client secret | The provider's **Client Secret** |
| Groups claim | `groups` |

## 1. Create the provider and application

1. In the authentik admin interface, open **Applications**, then **Providers**, and create an **OAuth2/OpenID Provider**.
2. Set:
   - **Name:** `Lobby`
   - **Authorization flow:** your usual one (the default explicit or implicit consent flow both work)
   - **Client type:** Confidential
   - **Redirect URIs:** `https://lobby.example.com/auth/callback` (in newer versions, add it as a **Strict** entry)
   - **Scopes:** keep the default `openid`, `email` and `profile` mappings
3. Save, and copy the **Client ID** and **Client Secret**.
4. Open **Applications**, then **Applications**, and create one:
   - **Name:** `Lobby`
   - **Slug:** `lobby` (the slug becomes part of the issuer)
   - **Provider:** the `Lobby` provider from above
5. Under the application's policy bindings, limit who can use Lobby if you need to.
   With no bindings, everyone can.

Some authentik versions also offer a single wizard that creates the application and provider together; it asks for the same values.

When people sign out of Lobby, authentik sends them back to `https://lobby.example.com/signed-out`.
If your authentik version asks for allowed post-logout redirect URIs, add that address there too; check your admin interface.

## 2. Send groups to Lobby

authentik's default `profile` scope mapping already includes a `groups` claim with the names of the person's groups, so there is nothing to change.

To confirm, open the provider and use its **Preview** tab (in recent versions) to see the claims for a test user.
If `groups` is missing, check that the provider still uses the default `profile` scope mapping.

## 3. Enter the details in Lobby

1. In the setup wizard's identity step, or later under Admin, Identity, choose **Authentik**.
2. Paste the issuer `https://auth.example.com/application/o/lobby/` (with the trailing slash), the client ID and the client secret.
3. Leave the groups claim as `groups`.
4. Choose **Test connection** and sign in with an authentik user who may use the application.

Expected result: Lobby shows who you signed in as and the list of their groups.

## 4. Turn on SCIM provisioning

authentik can push users and groups to Lobby over SCIM, so the directory is complete before anyone signs in.

1. In Lobby, create a SCIM token in the setup wizard's People step (or later in Lobby's admin area) and copy it.
   The token is shown once.
2. In authentik, open **Applications**, then **Providers**, and create a **SCIM Provider**:
   - **Name:** `Lobby SCIM`
   - **URL:** `https://lobby.example.com/api/scim/v2`
   - **Token:** the SCIM token from Lobby
3. Save.
4. Open the `Lobby` application, edit it, and add `Lobby SCIM` under **Backchannel providers**.
5. Back on the SCIM provider, run its sync (or wait for the scheduled one).

Expected result: users and groups appear in Lobby's people directory.

## 5. Open your other apps without a second sign-in

When someone signs in to Lobby, authentik keeps a session for them.
Any other app that also signs in through authentik then lets them straight in when they open it from the launcher.

For each app you add to Lobby:

1. Create a provider and application for it in authentik, and configure the app to sign in through it.
2. In Lobby, under Admin, Apps, add the app with its normal address as the launch URL.
   authentik also shows a launch URL on each application, which you can use instead.

## Troubleshooting

- **"Redirect URI Error":** the redirect URI in the provider must match `https://lobby.example.com/auth/callback` exactly.
- **Lobby says the issuer could not be reached:** the issuer needs the trailing slash, and the slug must match the application's slug.
