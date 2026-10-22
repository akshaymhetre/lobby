# Connect Lobby to Okta

This guide registers Lobby as an OpenID Connect app in Okta, sends group memberships to Lobby, turns on SCIM provisioning and makes your other apps open from the launcher without a second sign-in.
In the examples, Lobby lives at `https://lobby.example.com`; use your own `LOBBY_URL` instead.

Okta changes its admin console from time to time.
Where a menu name below might differ in your org, the step says so; look for the closest match.

## What you will need from this guide

| Lobby asks for | Where it comes from |
|---|---|
| Issuer | Your Okta org URL, for example `https://example.okta.com` |
| Client ID | The app's General tab |
| Client secret | The app's General tab |
| Groups claim | `groups` |

## 1. Create the app integration

1. In the Okta Admin Console, open **Applications**, then **Applications**, and choose **Create App Integration**.
2. Pick **OIDC - OpenID Connect** as the sign-in method and **Web Application** as the application type.
3. Fill in the settings:
   - **App integration name:** `Lobby`
   - **Grant type:** Authorization Code (on by default)
   - **Sign-in redirect URIs:** `https://lobby.example.com/auth/callback`
   - **Sign-out redirect URIs:** `https://lobby.example.com/signed-out`
   - **Assignments:** limit access to the groups who should use Lobby, or allow everyone in your organization.
4. Save, then copy the **Client ID** and **Client secret** from the General tab.

Lobby requests the scopes `openid email profile`, which every Okta app allows by default.

## 2. Send groups to Lobby

Lobby uses group names to decide who is an admin, a helpdesk agent or a content editor, and to decide who sees which apps and pages.

1. Open the Lobby app and go to the **Sign On** tab.
2. Under the OpenID Connect ID Token settings, edit the **Groups claim**:
   - **Groups claim type:** Filter
   - **Groups claim filter:** claim name `groups`, **Matches regex**, `.*`
3. Save.

To send fewer groups, use a narrower filter, for example **Starts with** `lobby-` plus the department groups you want to target content at.

This works when Lobby uses the org authorization server, whose issuer is your plain Okta URL.
If you use a custom authorization server (an issuer ending in `/oauth2/default` or similar), add the `groups` claim to that server instead, under **Security**, **API**, the server, **Claims**; check your admin console for the exact place.

## 3. Enter the details in Lobby

1. In the setup wizard's identity step, or later under Admin, Identity, choose **Okta**.
2. Paste the issuer, client ID and client secret.
3. Leave the groups claim as `groups`.
4. Choose **Test connection** and sign in with an Okta account assigned to the app.

Expected result: Lobby shows the account it signed in as, including its groups.
If the groups list is empty, recheck step 2.

Then open Admin, Roles and map your Okta groups to Lobby roles, for example `lobby-admins` to admin.

## 4. Turn on SCIM provisioning

SCIM lets Okta create, update and deactivate people and groups in Lobby as they change, instead of waiting for each person's first sign-in.

1. In Lobby, create a SCIM token in the setup wizard's People step (or later in Lobby's admin area) and copy it.
   The token is shown once.
2. In Okta, open the Lobby app's **General** tab, edit **App Settings**, and set **Provisioning** to **SCIM**.
   If your Okta org does not offer SCIM on an OIDC app, create a separate app integration for provisioning only; check your admin console.
3. On the new **Provisioning** tab, under **Integration**, fill in:
   - **SCIM connector base URL:** `https://lobby.example.com/api/scim/v2`
   - **Unique identifier field for users:** `userName`
   - **Supported provisioning actions:** Push New Users, Push Profile Updates and Push Groups
   - **Authentication Mode:** HTTP Header, with the SCIM token from Lobby as the bearer token
4. Choose **Test Connector Configuration**, then **Save**.
5. Under **Provisioning**, **To App**, enable Create Users, Update User Attributes and Deactivate Users.
6. On the **Push Groups** tab, push the groups Lobby should know about.

Expected result: people assigned to the app appear in Lobby's people directory within a minute or two.

## 5. Open your other apps without a second sign-in

When someone signs in to Lobby, Okta remembers their session.
Any other app that also signs in through Okta then lets them straight in when they open it from the launcher.

For each app you add to Lobby:

1. Make sure the app signs in through Okta and the person is assigned to it in Okta.
2. In Okta, open that app's **General** tab and copy its **App Embed Link**. This link starts the sign-in from Okta's side.
3. In Lobby, under Admin, Apps, add the app and paste that link as its launch URL.

If an app only supports sign-in started from the app itself, use the app's own login URL instead; Okta still signs the person in silently because their session is already there.

## Troubleshooting

- **"redirect_uri" error from Okta:** the sign-in redirect URI in Okta must be exactly `https://lobby.example.com/auth/callback`, with the same scheme and no trailing slash.
- **Signed in, but not an admin:** the group must be in the token (step 2) and mapped in Admin, Roles.
  Group names match exactly, including case.
- **Sign out leaves Okta signed in:** check the sign-out redirect URI from step 1.
