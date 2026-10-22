/**
 * Page templates: the structure a new page starts with. Pure, so the editor (client) can use it.
 */
import { markdownToDoc } from "./markdown";

export type PageTemplate = "blank" | "policy" | "how-to" | "team" | "onboarding-guide";

export interface TemplateInfo {
  key: PageTemplate;
  label: string;
  description: string;
  /** Default review interval in days for pages made from this template. */
  reviewDays: number;
  body: string;
}

export const TEMPLATES: TemplateInfo[] = [
  { key: "blank", label: "Blank page", description: "Start from nothing.", reviewDays: 180, body: "" },
  {
    key: "policy",
    label: "Policy",
    description: "Rules people must follow, with an acknowledgement.",
    reviewDays: 365,
    body: `## Summary

One or two sentences on what this policy covers and why it exists.

## Who this applies to

Everyone employed by the company, contractors and anyone with a company account.

## The policy

State the rules plainly. Use numbers, limits and dates rather than "reasonable".

## Exceptions

How to ask for an exception, and who approves it.

## Questions

Raise a ticket in [Help](/help/new) or ask the policy owner.`,
  },
  {
    key: "how-to",
    label: "How-to guide",
    description: "Step by step instructions for one task.",
    reviewDays: 180,
    body: `## Before you start

- What you need (access, hardware, approvals)

## Steps

1. First step
2. Second step
3. Third step

## Check it worked

How the reader knows they are done.

## If something goes wrong

:::info
Still stuck? Raise a ticket in [Help](/help/new) and include what you tried.
:::`,
  },
  {
    key: "team",
    label: "Team page",
    description: "Who a team is, what they own and how to reach them.",
    reviewDays: 180,
    body: `## What we do

A short description of the team's purpose.

## Who we are

- Name, role

## What we own

- Systems, processes or decisions this team is responsible for

## How to reach us

Channel, request types and response times.`,
  },
  {
    key: "onboarding-guide",
    label: "Onboarding guide",
    description: "A checklist for someone's first weeks.",
    reviewDays: 120,
    body: `## Your first day

- [ ] Sign in and set up multi-factor authentication
- [ ] Meet your manager and your buddy

## Your first week

- [ ] Read the handbook
- [ ] Set up your tools

## Your first month

- [ ] Agree your goals with your manager

## Who to ask

Your manager and buddy first, then [Help](/help/new).`,
  },
];

export function templateDoc(key: PageTemplate) {
  const t = TEMPLATES.find((x) => x.key === key) ?? TEMPLATES[0]!;
  return markdownToDoc(t.body);
}
