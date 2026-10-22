/**
 * The preset catalog an admin picks from when adding an app. Each preset carries sensible
 * defaults; `{domain}` and `{tenant}` in the launch URL are placeholders the admin replaces.
 * `icon` is "preset:<key>", resolved to a brand glyph by the web app (or a monogram when the
 * brand has no freely licensed icon).
 */
export type LaunchType = "sso_link" | "idp_initiated" | "bookmark";

export interface AppPreset {
  key: string;
  name: string;
  description: string;
  category: string;
  launchUrl: string;
  launchType: LaunchType;
  /** Brand colour, used for the monogram when no glyph exists. */
  color: string;
  /** Help shown next to the launch URL field. */
  urlHint: string;
}

export const APP_PRESETS: readonly AppPreset[] = [
  {
    key: "google-workspace",
    name: "Google Workspace",
    description: "Gmail, Calendar, Drive and Docs.",
    category: "Communication",
    launchUrl: "https://www.google.com/a/{domain}/ServiceLogin?continue=https://mail.google.com/",
    launchType: "sso_link",
    color: "#4285F4",
    urlHint: "Replace {domain} with your Google Workspace domain.",
  },
  {
    key: "microsoft-365",
    name: "Microsoft 365",
    description: "Outlook, Teams, Word, Excel and OneDrive.",
    category: "Communication",
    launchUrl: "https://www.office.com/login?domain_hint={domain}",
    launchType: "sso_link",
    color: "#D83B01",
    urlHint: "Replace {domain} with your Microsoft 365 domain.",
  },
  {
    key: "slack",
    name: "Slack",
    description: "Team chat, channels and huddles.",
    category: "Communication",
    launchUrl: "https://{tenant}.slack.com/sso/saml/start",
    launchType: "sso_link",
    color: "#4A154B",
    urlHint: "Replace {tenant} with your Slack workspace name.",
  },
  {
    key: "zoom",
    name: "Zoom",
    description: "Video meetings and webinars.",
    category: "Communication",
    launchUrl: "https://{tenant}.zoom.us/signin",
    launchType: "sso_link",
    color: "#0B5CFF",
    urlHint: "Replace {tenant} with your Zoom vanity URL.",
  },
  {
    key: "github",
    name: "GitHub",
    description: "Code, pull requests and reviews.",
    category: "Engineering",
    launchUrl: "https://github.com/orgs/{tenant}/sso",
    launchType: "sso_link",
    color: "#181717",
    urlHint: "Replace {tenant} with your GitHub organisation.",
  },
  {
    key: "grafana",
    name: "Grafana",
    description: "Dashboards and alerts for our services.",
    category: "Engineering",
    launchUrl: "https://grafana.{domain}/login/generic_oauth",
    launchType: "sso_link",
    color: "#F46800",
    urlHint: "Point this at Grafana's generic OAuth login so sign-in is silent.",
  },
  {
    key: "datadog",
    name: "Datadog",
    description: "Monitoring, logs and APM.",
    category: "Engineering",
    launchUrl: "https://app.datadoghq.com/account/login?saml=true",
    launchType: "sso_link",
    color: "#632CA6",
    urlHint: "Use your Datadog region's login URL with SAML enabled.",
  },
  {
    key: "aws-console",
    name: "AWS console",
    description: "Cloud accounts through IAM Identity Center.",
    category: "Engineering",
    launchUrl: "https://{tenant}.awsapps.com/start",
    launchType: "sso_link",
    color: "#232F3E",
    urlHint: "Replace {tenant} with your IAM Identity Center start URL prefix.",
  },
  {
    key: "jira",
    name: "Jira",
    description: "Issues, sprints and roadmaps.",
    category: "Work management",
    launchUrl: "https://{tenant}.atlassian.net/jira",
    launchType: "sso_link",
    color: "#0052CC",
    urlHint: "Replace {tenant} with your Atlassian site name.",
  },
  {
    key: "confluence",
    name: "Confluence",
    description: "Team spaces and documentation.",
    category: "Work management",
    launchUrl: "https://{tenant}.atlassian.net/wiki",
    launchType: "sso_link",
    color: "#172B4D",
    urlHint: "Replace {tenant} with your Atlassian site name.",
  },
  {
    key: "notion",
    name: "Notion",
    description: "Docs, wikis and project notes.",
    category: "Work management",
    launchUrl: "https://www.notion.so/login",
    launchType: "sso_link",
    color: "#000000",
    urlHint: "Notion detects SAML from your email domain on its login page.",
  },
  {
    key: "linear",
    name: "Linear",
    description: "Issues and product planning.",
    category: "Work management",
    launchUrl: "https://linear.app/{tenant}",
    launchType: "sso_link",
    color: "#5E6AD2",
    urlHint: "Replace {tenant} with your Linear workspace URL key.",
  },
  {
    key: "figma",
    name: "Figma",
    description: "Design files, prototypes and FigJam.",
    category: "Design",
    launchUrl: "https://www.figma.com/login",
    launchType: "sso_link",
    color: "#F24E1E",
    urlHint: "Or use your Figma SAML start URL for a silent sign-in.",
  },
  {
    key: "salesforce",
    name: "Salesforce",
    description: "Accounts, pipeline and forecasts.",
    category: "Sales",
    launchUrl: "https://{tenant}.my.salesforce.com",
    launchType: "sso_link",
    color: "#00A1E0",
    urlHint: "Replace {tenant} with your My Domain name.",
  },
  {
    key: "hubspot",
    name: "HubSpot",
    description: "Marketing, CRM and campaigns.",
    category: "Sales",
    launchUrl: "https://app.hubspot.com/login/sso",
    launchType: "sso_link",
    color: "#FF7A59",
    urlHint: "HubSpot's SSO login page signs in through your IdP.",
  },
  {
    key: "zendesk",
    name: "Zendesk",
    description: "Customer support tickets.",
    category: "Sales",
    launchUrl: "https://{tenant}.zendesk.com/access/sso",
    launchType: "sso_link",
    color: "#03363D",
    urlHint: "Replace {tenant} with your Zendesk subdomain.",
  },
  {
    key: "bamboohr",
    name: "BambooHR",
    description: "Time off, payslips and your HR record.",
    category: "People",
    launchUrl: "https://{tenant}.bamboohr.com/login.php",
    launchType: "sso_link",
    color: "#73C41D",
    urlHint: "Replace {tenant} with your BambooHR subdomain.",
  },
  {
    key: "workday",
    name: "Workday",
    description: "HR, payroll and performance.",
    category: "People",
    launchUrl: "https://www.myworkday.com/{tenant}",
    launchType: "sso_link",
    color: "#0875E1",
    urlHint: "Replace {tenant} with your Workday tenant name.",
  },
  {
    key: "1password",
    name: "1Password",
    description: "Shared vaults and passwords.",
    category: "Security",
    launchUrl: "https://{tenant}.1password.com",
    launchType: "bookmark",
    color: "#145FE4",
    urlHint: "1Password unlocks with your own account password, so this is a bookmark.",
  },
  {
    key: "custom",
    name: "Custom app",
    description: "Any other app your team uses.",
    category: "General",
    launchUrl: "https://",
    launchType: "sso_link",
    color: "#6B675F",
    urlHint: "Use the app's own login URL so it signs in through your identity provider.",
  },
];

export function getPreset(key: string): AppPreset | undefined {
  return APP_PRESETS.find((p) => p.key === key);
}

/** Plain-language explanations shown wherever a launch type is chosen or displayed. */
export const LAUNCH_TYPE_INFO: Record<LaunchType, { label: string; chip: string; explain: string }> = {
  sso_link: {
    label: "Single sign-on link",
    chip: "SSO",
    explain:
      "Opens the app's own login page. It hands off to your identity provider, which already knows you, so people land signed in without typing a password.",
  },
  idp_initiated: {
    label: "Sign in from the identity provider",
    chip: "IdP sign-in",
    explain:
      "Opens a link on your identity provider that signs people in and then sends them to the app. Use it when the app has no login URL of its own.",
  },
  bookmark: {
    label: "Bookmark",
    chip: "Bookmark",
    explain: "A plain link. The app asks people to sign in with its own account, if it needs one.",
  },
};
