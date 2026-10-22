export type ProviderKey = "okta" | "entra" | "google" | "keycloak" | "authentik" | "oidc";

export interface ProviderHelp {
  key: ProviderKey;
  name: string;
  /** Short line under the name in the picker. */
  blurb: string;
  issuerPlaceholder: string;
  /** Numbered, plain steps for creating the app registration in the provider's console. */
  steps: string[];
  groupsClaim: string;
  groupsNote: string;
  /** SCIM provisioning instructions for the People step. */
  scim: string[];
}

export const PROVIDERS: ProviderHelp[] = [
  {
    key: "okta",
    name: "Okta",
    blurb: "Okta Workforce Identity",
    issuerPlaceholder: "https://your-company.okta.com",
    steps: [
      "In the Okta Admin Console, go to Applications, then Create App Integration.",
      "Choose OIDC - OpenID Connect and Web Application.",
      "Paste the redirect URI below into Sign-in redirect URIs.",
      "Under Assignments, choose who can use Lobby (usually everyone).",
      "Copy the Client ID and Client secret from the General tab. The issuer is your Okta domain.",
    ],
    groupsClaim: "groups",
    groupsNote: "In the app's Sign On tab, set the groups claim filter to Matches regex .* so the token lists group names.",
    scim: [
      "Open the Lobby app in Okta and, on the General tab, enable SCIM provisioning.",
      "On the Provisioning tab, paste the SCIM base URL and choose HTTP Header authentication.",
      "Paste the token above as the Bearer token, then Test Connector Configuration.",
      "Enable Create Users, Update User Attributes and Deactivate Users, then push the groups you want.",
    ],
  },
  {
    key: "entra",
    name: "Microsoft Entra ID",
    blurb: "Formerly Azure Active Directory",
    issuerPlaceholder: "https://login.microsoftonline.com/<tenant-id>/v2.0",
    steps: [
      "In the Entra admin center, open App registrations and choose New registration.",
      "Pick Web as the platform and paste the redirect URI below.",
      "Copy the Application (client) ID. The Directory (tenant) ID goes into the issuer URL.",
      "Under Certificates and secrets, create a client secret and copy its Value (not its ID).",
    ],
    groupsClaim: "groups",
    groupsNote: "Under Token configuration, add a groups claim. Entra sends group object IDs unless you choose cloud-only group names, so map roles by the ID it sends.",
    scim: [
      "In Enterprise applications, add a non-gallery application for Lobby.",
      "Open Provisioning, set the mode to Automatic, and paste the SCIM base URL as the Tenant URL.",
      "Paste the token above as the Secret Token and choose Test Connection.",
      "Assign users and groups, then start provisioning. Entra syncs every 40 minutes.",
    ],
  },
  {
    key: "google",
    name: "Google Workspace",
    blurb: "Sign in with Google accounts",
    issuerPlaceholder: "https://accounts.google.com",
    steps: [
      "In Google Cloud Console, open APIs and Services, then Credentials.",
      "Create an OAuth client ID of type Web application.",
      "Paste the redirect URI below into Authorised redirect URIs.",
      "Copy the client ID and secret. The issuer is always https://accounts.google.com.",
      "Set the OAuth consent screen to Internal so only your Workspace can sign in.",
    ],
    groupsClaim: "groups",
    groupsNote: "Google does not put groups in the sign-in token. Use the CSV import or a SCIM bridge to bring groups in.",
    scim: [
      "Google Workspace does not push users over SCIM on its own.",
      "Export users from the Admin console as CSV and use the CSV import, or let accounts appear as people sign in.",
    ],
  },
  {
    key: "keycloak",
    name: "Keycloak",
    blurb: "Self-hosted, open source",
    issuerPlaceholder: "https://sso.your-company.com/realms/<realm>",
    steps: [
      "In your realm, open Clients and choose Create client of type OpenID Connect.",
      "Turn on Client authentication and the Standard flow.",
      "Paste the redirect URI below into Valid redirect URIs.",
      "Copy the secret from the Credentials tab. The issuer is your Keycloak URL plus /realms/<realm>.",
    ],
    groupsClaim: "groups",
    groupsNote: "Add a Group Membership mapper to the client's dedicated scope with the token claim name groups and Full group path turned off.",
    scim: [
      "Keycloak needs a SCIM extension (for example a SCIM client plugin) to push users.",
      "Point it at the SCIM base URL and use the token above as a Bearer token.",
      "Without the extension, accounts appear as people sign in and groups come from the token.",
    ],
  },
  {
    key: "authentik",
    name: "Authentik",
    blurb: "Self-hosted, open source",
    issuerPlaceholder: "https://auth.your-company.com/application/o/<slug>/",
    steps: [
      "In the Authentik admin interface, create an OAuth2/OpenID Provider.",
      "Set the client type to Confidential and paste the redirect URI below.",
      "Create an Application that uses this provider and note its slug.",
      "Copy the Client ID and Client Secret. The issuer ends in /application/o/<slug>/ with the trailing slash.",
    ],
    groupsClaim: "groups",
    groupsNote: "Authentik includes a groups claim with the profile scope by default.",
    scim: [
      "Create a SCIM Provider in Authentik and paste the SCIM base URL.",
      "Paste the token above as the token, then add the provider to the Lobby application as a backchannel provider.",
    ],
  },
  {
    key: "oidc",
    name: "Other OpenID Connect",
    blurb: "Any standards-compliant provider",
    issuerPlaceholder: "https://idp.your-company.com",
    steps: [
      "Register Lobby as a confidential web application that uses the authorization code flow.",
      "Paste the redirect URI below as an allowed redirect URI.",
      "Copy the client ID and secret. The issuer is the URL that serves /.well-known/openid-configuration.",
    ],
    groupsClaim: "groups",
    groupsNote: "If your provider can add group names to the ID token or userinfo, give the claim name here.",
    scim: [
      "If your provider supports SCIM 2.0 provisioning, paste the SCIM base URL and use the token above as a Bearer token.",
    ],
  },
];

export const providerHelp = (key: string | undefined) => PROVIDERS.find((p) => p.key === key) ?? PROVIDERS[5]!;
