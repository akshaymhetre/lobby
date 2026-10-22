# Connect Lobby to Keycloak

This guide registers Lobby as an OpenID Connect client in Keycloak, sends group memberships to Lobby, covers provisioning and makes your other apps open from the launcher without a second sign-in.
It is written against the Keycloak 26 admin console.
In the examples, Lobby lives at `https://lobby.example.com` and Keycloak at `https://sso.example.com` with a realm called `company`; use your own values instead.

The Lobby demo uses exactly this setup; `deploy/keycloak/realm-northwind.json` is a working example you can read alongside this guide.

## What you will need from this guide

| Lobby asks for | Where it comes from |
|---|---|
| Issuer | `https://sso.example.com/realms/company` |
| Client ID | `lobby`, or whatever you name the client |
| Client secret | The client's **Credentials** tab |
| Groups claim | `groups` |

## 1. Create the client

1. In the Keycloak admin console, switch to your realm and open **Clients**, then **Create client**.
2. **General settings:** client type **OpenID Connect**, client ID `lobby`, name `Lobby`.
   Choose **Next**.
3. **Capability config:** turn **Client authentication** on and keep **Standard flow** ticked.
   Choose **Next**.
4. **Login settings:**
   - **Root URL:** `https://lobby.example.com`
   - **Valid redirect URIs:** `https://lobby.example.com/auth/callback`
   - **Valid post logout redirect URIs:** `https://lobby.example.com/signed-out`
   - **Web origins:** `https://lobby.example.com`
5. Save, then copy the **Client secret** from the **Credentials** tab.

Lobby requests the scopes `openid email profile`, which Keycloak clients have by default.

## 2. Send groups to Lobby

1. Open the `lobby` client, then the **Client scopes** tab, and open `lobby-dedicated`.
2. Choose **Configure a new mapper** (or **Add mapper**, **By configuration**) and pick **Group Membership**.
3. Set:
   - **Name:** `groups`
   - **Token Claim Name:** `groups`
   - **Full group path:** off, so Lobby receives `lobby-admins` rather than `/lobby-admins`
   - **Add to ID token**, **Add to access token** and **Add to userinfo:** on
4. Save.

## 3. Enter the details in Lobby

1. In the setup wizard's identity step, or later under Admin, Identity, choose **Keycloak**.
2. Paste the issuer `https://sso.example.com/realms/company`, the client ID and the client secret.
3. Leave the groups claim as `groups`.
4. Choose **Test connection** and sign in with a user from the realm.

Expected result: Lobby shows who you signed in as and the list of their groups.

If Lobby runs in the same Docker network as Keycloak and reaches it on an internal address (for example `http://keycloak:8080`), the issuer must still be the public address browsers use.
Configure this case with the `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_DISCOVERY_URL` environment variables (the internal address goes in `OIDC_DISCOVERY_URL`), because the identity form does not have a discovery field yet.
Start Keycloak with `KC_HOSTNAME` set to its public address and `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true` so tokens are requested on the internal address.
The demo's `deploy/docker-compose.yml` shows this.

## 4. Provisioning

Keycloak does not push users to other apps over SCIM out of the box.
You have two options:

- **Sign-in provisioning (no setup).** Lobby creates each person's profile the first time they sign in and updates their groups from the token every time they sign in.
  People who have never signed in do not show up in the directory yet.
- **A SCIM extension.** Community extensions add a SCIM client to Keycloak.
  Point one at `https://lobby.example.com/api/scim/v2`, with a SCIM token from Lobby (setup wizard's People step) as the bearer token.
  Lobby does not test against any particular extension, so check that it supports SCIM 2.0 users and groups.

You can also import everyone once from a CSV in the setup wizard's People step, so the directory is complete from day one.

## 5. Open your other apps without a second sign-in

When someone signs in to Lobby, Keycloak keeps a session for them in the realm.
Any other app that also signs in through the same realm lets them straight in when they open it from the launcher.

For each app you add to Lobby:

1. Create a client for the app in the same realm and configure the app to sign in through it.
2. In Lobby, under Admin, Apps, add the app with its normal address as the launch URL.

The demo does this with Grafana and an Expenses app: open Grafana from Maya's launcher and you are in, with no second login.
See `deploy/docker-compose.yml` for how both are configured.

Keycloak's **SSO Session Idle** and **SSO Session Max** settings (under **Realm settings**, **Sessions**) decide how long that silent sign-in keeps working.

## Troubleshooting

- **"Invalid parameter: redirect_uri":** the valid redirect URI must cover `https://lobby.example.com/auth/callback` exactly.
- **Groups arrive as `/lobby-admins`:** turn off **Full group path** in the mapper, or map the full path in Admin, Roles.
- **"Invalid redirect uri" after signing out:** add `https://lobby.example.com/signed-out` to **Valid post logout redirect URIs**.
