# Connect Lobby to Google Workspace

This guide lets your people sign in to Lobby with their Google Workspace accounts, explains how to bring groups and people into Lobby without SCIM, and makes your other apps open from the launcher without a second sign-in.
In the examples, Lobby lives at `https://lobby.example.com`; use your own `LOBBY_URL` instead.

Google changes its consoles from time to time.
Where a menu name below might differ, the step says so; look for the closest match.

## Two things Google does differently

Google is the simplest provider to set up for sign-in, with two limits worth knowing before you start:

- **No groups in the sign-in token.** Google does not tell Lobby which groups a person is in when they sign in.
  Roles and group-based visibility therefore come from groups you bring into Lobby another way (see step 4).
- **No SCIM push to your own apps.** Google Workspace does not provision users to a custom app like Lobby over SCIM. People appear in Lobby the first time they sign in, or all at once through a CSV import.

## What you will need from this guide

| Lobby asks for | Where it comes from |
|---|---|
| Issuer | Always `https://accounts.google.com` |
| Client ID | The OAuth client you create in step 2 |
| Client secret | The same OAuth client |

## 1. Set up the consent screen

1. Sign in to the Google Cloud console with a Workspace admin account, and create or pick a project for Lobby.
2. Open **APIs & Services**, then **OAuth consent screen** (in newer consoles this lives under **Google Auth Platform**, **Branding** and **Audience**).
3. Set the user type (audience) to **Internal**.
   Internal means only accounts in your Workspace organization can sign in, which is what you want.
4. Fill in the app name (`Lobby`), a support email and your domain, and save.

Lobby only asks for `openid email profile`, which Google treats as basic scopes, so no verification review is needed.

## 2. Create the OAuth client

1. Open **APIs & Services**, then **Credentials** (or **Google Auth Platform**, **Clients**), and create an **OAuth client ID**.
2. Choose **Web application** as the application type and name it `Lobby`.
3. Under **Authorised redirect URIs**, add `https://lobby.example.com/auth/callback`.
4. Create it, and copy the **Client ID** and **Client secret**.

## 3. Enter the details in Lobby

1. In the setup wizard's identity step, or later under Admin, Identity, choose **Google Workspace**.
2. Paste the issuer `https://accounts.google.com`, the client ID and the client secret.
3. Choose **Test connection** and sign in with a Workspace account.

Expected result: Lobby shows who you signed in as.
It also reports that no groups came with the token; for Google that is expected.

Signing out of Lobby signs the person out of Lobby only.
Google does not offer a way for an app to end the Google session, so people stay signed in to Google.

## 4. Bring in people and groups

Pick one, or combine them:

- **Let people arrive as they sign in.** Each person gets a profile the first time they sign in.
  This needs no setup, but the directory and org chart fill up gradually.
- **Import a CSV.** Export your users from the Google Admin console (**Directory**, **Users**, then download) and import the file in the setup wizard's People step.
  Include a groups column to put people into Lobby groups, which you can then map to roles in Admin, Roles.
- **Use a SCIM bridge.** If you already run a tool that reads Google Workspace and speaks SCIM 2.0, point it at `https://lobby.example.com/api/scim/v2` with a SCIM token from Lobby.

Your first admin is the break-glass account created in the setup wizard.
Use it to give other people roles, for example by importing them into a `lobby-admins` group and mapping that group to admin.

## 5. Open your other apps without a second sign-in

When someone signs in to Lobby with Google, Google remembers their session.
Any other app that offers "Sign in with Google" or uses Google Workspace single sign-on then lets them straight in when they open it from the launcher, usually with one click to pick the account.

For each app you add to Lobby under Admin, Apps, use the app's own sign-in address as its launch URL.
For apps set up as SAML apps in the Google Admin console, you can instead check the app's settings in the Admin console for a link that starts the sign-in from Google's side.

## Troubleshooting

- **Error 400: redirect_uri_mismatch:** the authorised redirect URI must be exactly `https://lobby.example.com/auth/callback`.
- **"Access blocked" for a personal Gmail account:** that is the Internal setting working as intended.
  Only your Workspace accounts can sign in.
