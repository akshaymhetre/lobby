/**
 * The starter service catalog: four teams and fifteen request types with fixed slugs
 * (see docs/architecture.md). Pure data with no imports, so both `installStarterCatalog()`
 * and the demo seed (packages/db) build from one definition instead of two copies.
 */
import type { FormFieldDef } from "./fields";

export interface StarterTeam {
  slug: "it" | "people" | "workplace" | "finance";
  name: string;
  description: string;
  icon: string;
  /** Group whose members work this queue, when such a group exists. */
  agentGroup: string;
  sortOrder: number;
}

export interface StarterRequestType {
  slug: string;
  team: StarterTeam["slug"];
  name: string;
  description: string;
  icon: string;
  fields: FormFieldDef[];
  /** `group` names a group; when it does not exist the team's agent group is used. */
  approval: { mode: "none" | "manager" | "group" | "manager_then_group"; group?: string };
  /** Which starter SLA policy applies. */
  sla: "standard" | "people";
  defaultPriority: "low" | "normal" | "high" | "urgent";
}

export const STARTER_TEAMS: StarterTeam[] = [
  { slug: "it", name: "IT", description: "Laptops, accounts, access and anything with a power cable.", icon: "monitor", agentGroup: "it-team", sortOrder: 1 },
  { slug: "people", name: "People", description: "Pay, leave, benefits and changes to your details.", icon: "heart-handshake", agentGroup: "people-team", sortOrder: 2 },
  { slug: "workplace", name: "Workplace", description: "Office passes, desks, guests and the building.", icon: "building-2", agentGroup: "facilities", sortOrder: 3 },
  { slug: "finance", name: "Finance", description: "Expenses, company cards and getting paid back.", icon: "receipt", agentGroup: "finance", sortOrder: 4 },
];

export const STARTER_SLA_POLICIES = {
  standard: {
    name: "Standard business hours",
    targets: {
      urgent: { firstResponse: 30, resolution: 240 },
      high: { firstResponse: 60, resolution: 510 },
      normal: { firstResponse: 240, resolution: 1530 },
      low: { firstResponse: 510, resolution: 2550 },
    },
  },
  people: {
    name: "People and pay",
    targets: {
      urgent: { firstResponse: 60, resolution: 510 },
      high: { firstResponse: 240, resolution: 1020 },
      normal: { firstResponse: 510, resolution: 2550 },
      low: { firstResponse: 1020, resolution: 5100 },
    },
  },
} as const;

const OFFICES = ["London", "Berlin", "Austin", "Bengaluru"];

export const STARTER_REQUEST_TYPES: StarterRequestType[] = [
  {
    slug: "new-laptop",
    team: "it",
    name: "New laptop",
    description: "Ask for a new or replacement laptop. Your manager approves it, then IT sets it up.",
    icon: "laptop",
    approval: { mode: "manager" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "model", label: "Model", type: "select", required: true, options: ['MacBook Air 13"', 'MacBook Pro 14"', 'MacBook Pro 16"', "ThinkPad X1 Carbon"], help: "Engineers usually pick the MacBook Pro 14." },
      { key: "keyboard_layout", label: "Keyboard layout", type: "select", required: true, options: ["UK", "US", "German", "Nordic"] },
      { key: "needed_by", label: "Needed by", type: "date", required: true },
      { key: "replacement", label: "This replaces a laptop I have now", type: "checkbox" },
      { key: "old_asset_tag", label: "Asset tag of the old laptop", type: "text", required: true, showIf: { key: "replacement", equals: true }, help: "It's on the sticker underneath, like NW-1042." },
    ],
  },
  {
    slug: "app-access",
    team: "it",
    name: "Access to an app",
    description: "Get access to a tool you can't open yet. Your manager approves, then IT.",
    icon: "key-round",
    approval: { mode: "manager_then_group", group: "it-team" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "app", label: "App", type: "app", required: true },
      { key: "access_level", label: "Access level", type: "select", options: ["Standard", "Admin"], help: "Leave this empty for standard access." },
      { key: "reason", label: "What do you need it for?", type: "textarea", required: true },
      { key: "temporary", label: "I only need it for a while", type: "checkbox" },
      { key: "until", label: "Access until", type: "date", required: true, showIf: { key: "temporary", equals: true } },
    ],
  },
  {
    slug: "password-mfa-reset",
    team: "it",
    name: "Password or MFA reset",
    description: "Locked out, lost your phone, or your authenticator stopped working.",
    icon: "lock-keyhole",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "high",
    fields: [
      { key: "account", label: "Which account?", type: "select", required: true, options: ["Google Workspace", "Slack", "GitHub", "1Password", "Something else"] },
      { key: "problem", label: "What happened?", type: "select", required: true, options: ["Forgot my password", "Lost or replaced my phone", "Account is locked", "Something else"] },
      { key: "blocked", label: "I can't work until this is fixed", type: "checkbox" },
    ],
  },
  {
    slug: "vpn-issue",
    team: "it",
    name: "VPN problem",
    description: "The VPN won't connect, keeps dropping, or is very slow.",
    icon: "shield",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "where", label: "Where are you working from?", type: "select", required: true, options: ["An office", "Home", "Travelling"] },
      { key: "error", label: "Error message, if any", type: "text", help: "Copy it exactly, it helps us find the cause." },
      { key: "internet_ok", label: "Other websites load fine", type: "checkbox" },
    ],
  },
  {
    slug: "hardware-problem",
    team: "it",
    name: "Broken or faulty hardware",
    description: "Something physical isn't working: a laptop, monitor, dock or headset.",
    icon: "wrench",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "device", label: "Device", type: "select", required: true, options: ["Laptop", "Monitor", "Dock or cable", "Keyboard or mouse", "Headset", "Phone", "Something else"] },
      { key: "asset_tag", label: "Asset tag", type: "text", help: "Optional. It's on the sticker, like NW-1042." },
      { key: "blocked", label: "I can't work until this is fixed", type: "checkbox" },
    ],
  },
  {
    slug: "software-request",
    team: "it",
    name: "New software",
    description: "Ask for a tool or licence we don't have yet. Your manager approves the cost.",
    icon: "package",
    approval: { mode: "manager" },
    sla: "standard",
    defaultPriority: "low",
    fields: [
      { key: "software", label: "Software", type: "text", required: true },
      { key: "seats", label: "How many people need it?", type: "number" },
      { key: "yearly_cost", label: "Rough yearly cost (GBP)", type: "number", help: "A guess is fine." },
      { key: "reason", label: "Why do you need it?", type: "textarea", required: true },
    ],
  },
  {
    slug: "onboarding-equipment",
    team: "it",
    name: "Kit for a new starter",
    description: "Laptop, accounts and accessories ready for someone's first day.",
    icon: "user-plus",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "new_starter", label: "New starter", type: "user", required: true },
      { key: "start_date", label: "Start date", type: "date", required: true },
      { key: "laptop", label: "Laptop", type: "select", required: true, options: ['MacBook Air 13"', 'MacBook Pro 14"', 'MacBook Pro 16"', "ThinkPad X1 Carbon"] },
      { key: "extras", label: "Anything else they need?", type: "textarea", help: "Monitor, headset, standing desk..." },
    ],
  },
  {
    slug: "offboarding-return",
    team: "it",
    name: "Return kit when someone leaves",
    description: "Arrange the return of a leaver's laptop and accessories.",
    icon: "package-open",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "leaver", label: "Who is leaving?", type: "user", required: true },
      { key: "last_day", label: "Last working day", type: "date", required: true },
      { key: "return_method", label: "How will the kit come back?", type: "select", required: true, options: ["Dropped at an office", "Courier pickup"] },
      { key: "pickup_address", label: "Pickup address", type: "textarea", required: true, showIf: { key: "return_method", equals: "Courier pickup" } },
    ],
  },
  {
    slug: "payroll-question",
    team: "people",
    name: "Pay and payslips",
    description: "Questions about your payslip, tax code, pension or a bonus.",
    icon: "banknote",
    approval: { mode: "none" },
    sla: "people",
    defaultPriority: "normal",
    fields: [
      { key: "topic", label: "Topic", type: "select", required: true, options: ["Payslip", "Tax code", "Pension", "Bonus or commission", "Something else"] },
      { key: "pay_period", label: "Which pay period?", type: "text", help: "For example, September 2026." },
    ],
  },
  {
    slug: "leave-question",
    team: "people",
    name: "Leave and time off",
    description: "Holiday balance, sick leave, parental leave or time off for something else.",
    icon: "calendar-days",
    approval: { mode: "none" },
    sla: "people",
    defaultPriority: "normal",
    fields: [
      { key: "leave_type", label: "Type of leave", type: "select", required: true, options: ["Annual leave", "Sick leave", "Parental leave", "Compassionate leave", "Unpaid leave", "Something else"] },
      { key: "dates", label: "Dates, if you know them", type: "text" },
    ],
  },
  {
    slug: "update-personal-details",
    team: "people",
    name: "Update my details",
    description: "Change your address, emergency contact or legal name.",
    icon: "id-card",
    approval: { mode: "none" },
    sla: "people",
    defaultPriority: "low",
    fields: [
      { key: "what", label: "What's changing?", type: "select", required: true, options: ["Home address", "Emergency contact", "Legal name", "Bank details", "Something else"] },
      { key: "bank_note", label: "We'll send you a secure form for bank details. Please don't type them here.", type: "checkbox", required: true, showIf: { key: "what", equals: "Bank details" } },
      { key: "effective_from", label: "Effective from", type: "date" },
    ],
  },
  {
    slug: "building-access",
    team: "workplace",
    name: "Office pass or guest access",
    description: "A new or replacement pass, out-of-hours access, or a guest visiting.",
    icon: "door-open",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "need", label: "What do you need?", type: "select", required: true, options: ["New pass", "Lost or broken pass", "Guest access", "Out-of-hours access"] },
      { key: "office", label: "Office", type: "select", required: true, options: OFFICES },
      { key: "guest_name", label: "Guest's name", type: "text", required: true, showIf: { key: "need", equals: "Guest access" } },
      { key: "visit_date", label: "Visit date", type: "date", required: true, showIf: { key: "need", equals: "Guest access" } },
    ],
  },
  {
    slug: "desk-booking",
    team: "workplace",
    name: "Desk or room setup",
    description: "A standing desk, a second monitor, or a desk near your team.",
    icon: "armchair",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "low",
    fields: [
      { key: "office", label: "Office", type: "select", required: true, options: OFFICES },
      { key: "need", label: "What would help?", type: "select", required: true, options: ["Standing desk", "Second monitor", "Quiet area", "Sit near my team", "Something else"] },
      { key: "from_date", label: "From", type: "date" },
    ],
  },
  {
    slug: "expense-question",
    team: "finance",
    name: "Expenses and company cards",
    description: "A claim that hasn't been paid, a policy question, or a card problem.",
    icon: "receipt",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [
      { key: "topic", label: "Topic", type: "select", required: true, options: ["Claim not paid yet", "Is this claimable?", "Company card", "Missing receipt", "Something else"] },
      { key: "claim_reference", label: "Claim reference", type: "text", showIf: { key: "topic", equals: "Claim not paid yet" } },
      { key: "amount", label: "Amount (GBP)", type: "number" },
    ],
  },
  {
    slug: "something-else",
    team: "it",
    name: "Something else",
    description: "Not sure where it goes? Tell us and we'll get it to the right team.",
    icon: "message-circle-question",
    approval: { mode: "none" },
    sla: "standard",
    defaultPriority: "normal",
    fields: [],
  },
];
