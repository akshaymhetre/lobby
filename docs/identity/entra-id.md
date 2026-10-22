# Connect Lobby to Microsoft Entra ID

This guide registers Lobby as an OpenID Connect app in Microsoft Entra ID (formerly Azure Active Directory), sends group memberships to Lobby, turns on SCIM provisioning and makes your other apps open from the launcher without a second sign-in.
In the examples, Lobby lives at `https://lobby.example.com`; use your own `LOBBY_URL` instead.

Microsoft renames parts of the admin center regularly.
Where a menu name below might differ, the step says so; look for the closest match.

## What you will need from this guide

| Lobby asks for | Where it comes from |
|---|---|
| Issuer | `https://login.microsoftonline.com/<tenant-id>/v2.0`, with your Directory (tenant) ID |
| Client ID | The Application (client) ID |
| Client secret | The secret's **Value**, not its ID |
| Groups claim | `groups` |

## 1. Create the app

Create Lobby as an enterprise application first, because that is the kind of app Entra can provision users to over SCIM.
It creates the matching app registration for you.

1. In the Microsoft Entra admin center, open **Enterprise applications** and choose **New application**.
2. Choose **Create your own application**, name it `Lobby`, and pick the option for an application you do not find in the gallery (non-gallery).
3. Open **App registrations**, select **All applications**, and open `Lobby`.
4. Under **Authentication**, add a platform of type **Web** with these redirect URIs:
   - `https://lobby.example.com/auth/callback`
   - `https://lobby.example.com/signed-out`
5. Under **Certificates & secrets**, create a new client secret and copy its **Value** straight away; Entra shows it only once.
   Note its expiry date: sign-in stops working when it expires, so set a reminder to renew it.
6. On the **Overview** page, copy the **Application (client) ID** and the **Directory (tenant) ID**.

Lobby requests the scopes `openid email profile`.
These are standard OpenID Connect scopes and need no extra API permissions.

## 2. Make sure Lobby gets an email address

Entra puts an `email` claim in the token only when the person has an email address on their account.
To be explicit, open the app registration's **Token configuration**, choose **Add optional claim**, pick **ID**, and add `email`.

## 3. Send groups to Lobby

1. In the app registration, open **Token configuration** and choose **Add groups claim**.
2. Choose **Groups assigned to the application**, and tick it for the **ID** token.
   This sends only the groups you assign to Lobby, which keeps tokens small.
   (People in many groups can exceed the size limit for a token if you send every group they belong to.)
3. Save.
4. In **Enterprise applications**, open `Lobby`, then **Users and groups**, and assign the groups that should use Lobby.

Assigning groups (rather than individual people) to an app needs an Entra ID P1 or higher licence.
Without it, choose **Security groups** in step 2 instead, which sends every security group the person belongs to.

Entra sends **group object IDs** (long identifiers like `3f2a...`), not group names, for groups created in the cloud.
So in Lobby, map roles using those IDs: copy a group's **Object ID** from its overview page in Entra and use it as the group name in Admin, Roles.
If your groups are synchronised from on-premises Active Directory, Entra can send their names instead (check the group claim options in your admin center).

## 4. Enter the details in Lobby

1. In the setup wizard's identity step, or later under Admin, Identity, choose **Microsoft Entra ID**.
2. Paste the issuer (`https://login.microsoftonline.com/<tenant-id>/v2.0`), client ID and client secret.
3. Leave the groups claim as `groups`.
4. Choose **Test connection** and sign in with an account assigned to the app.

Expected result: Lobby shows who you signed in as and the groups it received.
If no groups appear, recheck step 3, including the assignment.

## 5. Turn on SCIM provisioning

SCIM lets Entra create, update and deactivate people and groups in Lobby as they change.

1. In Lobby, create a SCIM token in the setup wizard's People step (or later in Lobby's admin area) and copy it.
   The token is shown once.
2. In **Enterprise applications**, open `Lobby`, then **Provisioning**, and choose **Get started** or **Connect your application** (the label varies).
3. Set **Provisioning Mode** to **Automatic** and fill in **Admin Credentials**:
   - **Tenant URL:** `https://lobby.example.com/api/scim/v2`
   - **Secret Token:** the SCIM token from Lobby
4. Choose **Test Connection**, then **Save**.
5. Review the attribute mappings for users and groups.
   The defaults work for most companies.
6. Set **Provisioning Status** to **On** and save.

Entra provisions the users and groups assigned to the app.
The first cycle starts within a few minutes; after that Entra syncs about every 40 minutes, so a change can take that long to show up in Lobby.

## 6. Open your other apps without a second sign-in

When someone signs in to Lobby, Entra remembers their session.
Any other app that also signs in through Entra then lets them straight in when they open it from the launcher.

For each app you add to Lobby:

1. Make sure the app signs in through Entra and the person is assigned to it.
2. In **Enterprise applications**, open that app, then **Properties**, and copy the **User access URL**. This link starts the sign-in from Entra's side, which suits apps that only support sign-in started by the identity provider.
3. In Lobby, under Admin, Apps, add the app and paste that link, or the app's own sign-in address, as its launch URL.

## Troubleshooting

- **AADSTS50011 (redirect URI mismatch):** the redirect URI in step 1 must be exactly `https://lobby.example.com/auth/callback`, under the **Web** platform, not Single-page application.
- **AADSTS7000215 (invalid client secret):** you pasted the secret's ID instead of its Value, or the secret has expired.
- **Signed in, but not an admin:** map the group's Object ID, not its display name, in Admin, Roles.
