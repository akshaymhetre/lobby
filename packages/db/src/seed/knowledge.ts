import { eq, inArray } from "drizzle-orm";
import { db } from "../client";
import * as s from "../schema/index";
// Pure helpers (no imports of their own) shared with @lobby/core, so seed content is parsed exactly like editor content.
import { markdownToDoc } from "../../../core/src/knowledge/markdown";
import { docToText, type DocNode } from "../../../core/src/knowledge/doc";
import { daysFromToday, hoursAgo, type SeedContext } from "./util";

type Template = "blank" | "policy" | "how-to" | "team" | "onboarding-guide";

interface SeedPage {
  slug: string;
  title: string;
  owner: string;
  template?: Template;
  parent?: string;
  /** Days from today until the review date. Negative = stale. */
  review: number;
  /** Days since it was last verified. */
  verified: number;
  updatedHoursAgo: number;
  status?: "published" | "draft";
  /** Older revisions shown in the version history, oldest first: [title, markdown, days ago]. */
  history?: [string, string, number][];
  body: string;
}

interface SeedSpace {
  slug: string;
  name: string;
  icon: string;
  description: string;
  editors: string[];
  visibleTo?: string[];
  pages: SeedPage[];
}

const SPACES: SeedSpace[] = [
  {
    slug: "company",
    name: "Company",
    icon: "building-2",
    description: "Who we are, what we are building and how we work together.",
    editors: ["leadership"],
    pages: [
      {
        slug: "welcome-to-northwind",
        title: "Welcome to Northwind Labs",
        owner: "elena.vasquez",
        template: "onboarding-guide",
        review: 120,
        verified: 30,
        updatedHoursAgo: 30 * 24,
        body: `We are glad you are here. Northwind Labs builds supply chain planning software for mid-sized manufacturers: we help a factory in Stuttgart or Pune know what to order, when, and from whom. We are about 120 people across London (headquarters), Berlin, Austin and Bengaluru, plus a handful of people who work fully remote.

This page is the map. Everything else in Lobby hangs off it.

## Your first day

- [ ] Sign in to Google Workspace and set up multi-factor authentication (see [Passwords and MFA](/knowledge/it/password-and-mfa))
- [ ] Unbox your laptop and follow [Setting up your laptop](/knowledge/it/laptop-setup)
- [ ] Join Slack and say hello in #introductions with one fact nobody would guess
- [ ] Meet your manager and your onboarding buddy (your journey in Lobby names them)
- [ ] Open the Onboarding section of Lobby: your checklist lives there

## Your first week

- [ ] Read the [Employee handbook](/knowledge/people/employee-handbook) and acknowledge the [Code of conduct](/knowledge/people/code-of-conduct)
- [ ] Complete the 25 minute security awareness course in BambooHR
- [ ] Book a 30 minute coffee with someone outside your team (the #coffee-roulette bot pairs you every Monday)
- [ ] Attend Thursday's all-hands at 15:00 UK time

## Your first month

- [ ] Agree your 30-60-90 day goals with your manager
- [ ] Ship something small. Engineers usually merge a pull request in week one
- [ ] Give feedback on onboarding: the People team reads every answer

## Rhythms worth knowing

| What | When | Where |
|---|---|---|
| All-hands | Thursdays 15:00 UK, every other week | Zoom and the London office kitchen |
| Monthly business review | First Tuesday of the month | Leadership only, notes shared in #company |
| Demo day | Last Friday of the month, 16:00 UK | Zoom, recorded |
| Quiet Wednesdays | Every Wednesday | No internal meetings before 14:00 local time |

## Who to ask

Your manager and buddy first. For anything about laptops, accounts, pay, leave or the office, raise a ticket in [Help](/help/new): it reaches the right team and you can follow its progress. Ask the Lobby assistant if you just need to find a page.`,
      },
      {
        slug: "mission-and-values",
        title: "Mission and values",
        owner: "elena.vasquez",
        review: 160,
        verified: 20,
        updatedHoursAgo: 20 * 24,
        body: `## Our mission

Make every factory as well-planned as the best one in the world. Most manufacturers still plan production in spreadsheets emailed between people. We replace that with software that plans continuously and explains its reasoning, so planners spend their time on judgement rather than copy and paste.

## Our values

### Customers first, then the team, then the individual

When these conflict, this is the order. We would rather miss an internal deadline than ship something that breaks a customer's month-end.

### Write it down

Decisions, plans and reasoning live in writing. A good written proposal beats a good meeting. If it is not written down, it did not happen, and the next person cannot build on it.

### Small and often

We ship in small, reversible steps. A change that can be rolled back in five minutes needs less ceremony than one that cannot.

### Disagree, then commit

Say what you think, with your reasons, before the decision. Once it is made, help it succeed. You can reopen a decision with new evidence, not with the same argument louder.

### Leave it better

Fix the broken thing you walk past, or at least file it. That applies to code, documents, processes and the office kitchen.

## How we use them

Values show up in hiring scorecards, in performance reviews and in how we make trade-offs. If you see a decision that contradicts them, say so in #ask-leadership or to Elena directly.`,
      },
      {
        slug: "company-calendar-2026",
        title: "Company calendar 2026",
        owner: "nora.sullivan",
        review: 30,
        verified: 150,
        updatedHoursAgo: 150 * 24,
        body: `Key company dates for 2026. Public holidays differ by office: see the [Holiday policy](/knowledge/people/holiday-policy) for those.

| Date | Event |
|---|---|
| 22 January | Annual kick-off, London (everyone invited, travel booked by the People team) |
| 31 March | Financial year end |
| April | Performance review cycle opens |
| 18 to 19 June | Summer offsite, Lisbon |
| 2 July | Mid-year business review |
| October | Performance review cycle opens |
| 11 December | Winter party in each office |
| 24 December to 1 January | Office closure: three extra days off for everyone |

## Office closure

The office closure days (24, 29, 30 and 31 December, minus public holidays) are on top of your annual leave. Support and on-call rotas still run; people on those rotas take the days in lieu.`,
      },
      {
        slug: "how-we-make-decisions",
        title: "How we make decisions",
        owner: "david.kim",
        review: 75,
        verified: 50,
        updatedHoursAgo: 50 * 24,
        body: `Most decisions do not need a meeting. Use the lightest process that fits.

## Two kinds of decision

- **Reversible** (a library choice, a page layout, a pricing experiment): the person doing the work decides, writes one paragraph in the relevant Slack channel, and moves on.
- **Hard to reverse** (a new database, a vendor contract over 25,000 GBP a year, a hiring plan change): write a decision record in Notion using the "Decision record" template and give reviewers three working days.

## A good decision record

1. The problem in two sentences
2. The options you considered, including doing nothing
3. What you recommend and why
4. What would make you change your mind

## Who decides

The directly responsible individual named on the record. Reviewers advise; they do not hold a veto unless the record says so (security and legal sometimes do).`,
      },
    ],
  },
  {
    slug: "people",
    name: "People",
    icon: "users",
    description: "Leave, benefits, policies and everything about working here.",
    editors: ["people-team"],
    pages: [
      {
        slug: "employee-handbook",
        title: "Employee handbook",
        owner: "amara.nwosu",
        template: "policy",
        review: 95,
        verified: 85,
        updatedHoursAgo: 12 * 24,
        body: `This handbook explains how employment at Northwind Labs works. Where a country's law gives you more, the law wins. Your contract and the policies linked here are the source of truth.

## Working hours

Full-time is 37.5 hours a week. Core collaboration hours are 10:00 to 16:00 in your local time zone. Outside those, arrange your day as you like, provided your team knows how to reach you.

## Where you work

We are hybrid. People attached to an office come in on their team's anchor days (usually Tuesday and Thursday). Fully remote roles are agreed in writing at offer stage. You may work from another country for up to 20 working days a year: tell People at least two weeks ahead using the "Leave question" request in Help, because tax and insurance rules apply.

## Time off

- Annual leave: see the [Holiday policy](/knowledge/people/holiday-policy)
- Parental leave: see [Parental leave](/knowledge/people/parental-leave)
- Sick leave: see [Sick leave](/knowledge/people/sick-leave)

## Pay

You are paid monthly on the 25th, or the last working day before it. Payslips appear in BambooHR. Questions go to the "Payroll question" request in Help.

## Benefits

See the [Benefits overview](/knowledge/people/benefits-overview) for pension, health insurance and the learning budget.

## Conduct

Everyone must read and acknowledge the [Code of conduct](/knowledge/people/code-of-conduct).

## Leaving

Notice periods are in your contract (one month for most roles, three months for directors). Return equipment using the "Offboarding return" request in Help.`,
      },
      {
        slug: "holiday-policy",
        title: "Holiday policy",
        owner: "priya.raman",
        template: "policy",
        parent: "employee-handbook",
        review: 4,
        verified: 176,
        updatedHoursAgo: 176 * 24,
        history: [["Holiday policy", "Everyone gets 25 days of annual leave plus public holidays. Book leave in BambooHR.", 400]],
        body: `## Summary

Everyone at Northwind Labs gets **27 days of annual leave** a year, plus the public holidays of the country you work in, plus the company closure days between Christmas and New Year. Part-time colleagues get the same, pro rata.

## Who this applies to

All employees on a permanent or fixed-term contract. Contractors agree time off with their engagement manager.

## How much leave you get

| Length of service | Annual leave |
|---|---|
| Under 2 years | 27 days |
| 2 to 5 years | 28 days |
| 5 years or more | 30 days |

The leave year runs from 1 January to 31 December. If you join or leave part way through, your allowance is pro rata, rounded up to the nearest half day.

## Booking leave

1. Request the days in BambooHR at least **two weeks ahead** for anything longer than three days.
2. Your manager approves or declines within three working days. Silence is not approval: chase them.
3. Add the time to your Google Calendar as "Out of office" so meetings are declined automatically.

Single days can be booked with a day's notice.

## Carrying days over

You may carry over **up to 5 unused days** into the next year. They must be used by 31 March or they are lost. Carry-over beyond 5 days needs approval from Amara Nwosu and is only given when the business stopped you taking leave (for example a long customer launch).

## Public holidays by office

- **London**: 8 English bank holidays
- **Berlin**: 9 Berlin public holidays, including International Women's Day (8 March)
- **Austin**: 10 US federal holidays observed by the company
- **Bengaluru**: 12 holidays, published in January by the People team
- **Remote**: the public holidays of your country of residence

## Buying and selling leave

Once a year, in November, you can buy up to 5 extra days (deducted from salary over the following year) or sell up to 3 days back. Use the "Leave question" request in Help.

## Exceptions

Speak to your manager first, then Priya Raman. Exceptions are recorded in BambooHR.`,
      },
      {
        slug: "parental-leave",
        title: "Parental leave",
        owner: "priya.raman",
        template: "policy",
        parent: "employee-handbook",
        review: 140,
        verified: 40,
        updatedHoursAgo: 40 * 24,
        body: `## Summary

Every new parent at Northwind Labs gets **26 weeks at full pay**, whatever their gender and however their child arrives: birth, adoption or surrogacy. This is on top of whatever your country's statutory scheme provides, never instead of it.

## Eligibility

You qualify once you have worked here for **six months** by the expected week of birth or placement. If you have worked here for less, you still get your statutory entitlement plus 8 weeks at full pay.

## What you get

| | Birth parent | Second parent, adopter or surrogate parent |
|---|---|---|
| Full pay | 26 weeks | 26 weeks |
| Further unpaid leave | Up to 26 weeks | Up to 26 weeks |
| Must be taken within | 18 months of the birth or placement | 18 months of the birth or placement |

You can take the leave in up to three blocks, each at least two weeks long.

## Keeping in touch

You may work up to 10 "keeping in touch" days during your leave, paid at your normal rate. They are optional and never expected.

## Coming back

- A phased return: work 60 percent of your hours for full pay during your first four weeks back.
- Your job, or one of the same level and pay, is guaranteed.
- A private room with a fridge is available in every office. Book it in the desk booking tool.

## How to request it

1. Tell your manager when you are ready to.
2. At least **15 weeks** before the expected date, raise a "Leave question" request in Help and choose "Parental leave". Priya Raman will set up a planning call.
3. Agree a handover plan with your manager four weeks before you go.

## Pregnancy loss

If you or your partner experience a pregnancy loss at any stage, you are entitled to 10 days of paid leave, no questions asked. Tell your manager or anyone in the People team.`,
      },
      {
        slug: "sick-leave",
        title: "Sick leave",
        owner: "sofia.lindqvist",
        template: "policy",
        parent: "employee-handbook",
        review: 110,
        verified: 70,
        updatedHoursAgo: 70 * 24,
        body: `## Summary

If you are ill, rest. You get **full pay for up to 20 working days** of sickness in any rolling 12 months, then statutory sick pay. Long-term illness is handled case by case with the People team, always generously.

## On the day

1. Tell your manager by 10:00 local time, by Slack or phone. You do not need to say what is wrong.
2. Record the day in BambooHR when you are back.

## Longer absences

From the 8th calendar day you need a fit note (UK), an Arbeitsunfähigkeitsbescheinigung (Germany) or a doctor's note (US and India). Upload it to BambooHR.

## Mental health

Mental health days are sick days. Our health insurance includes 8 free therapy sessions a year through the employee assistance programme, details in the [Benefits overview](/knowledge/people/benefits-overview).`,
      },
      {
        slug: "code-of-conduct",
        title: "Code of conduct",
        owner: "amara.nwosu",
        template: "policy",
        review: 200,
        verified: 15,
        updatedHoursAgo: 15 * 24,
        body: `## Summary

We expect everyone to treat colleagues, customers and partners with respect, to act honestly and to protect the trust customers place in us. Read this page and confirm below that you have read and understood it. New starters must do this in their first week.

## Who this applies to

Every employee, contractor, intern and anyone representing Northwind Labs, in the office, online, at events and at offsites.

## Respect

- Harassment, bullying and discrimination are not tolerated, whether in person, in Slack or anywhere else.
- Disagree with ideas, not people. Assume good intent and ask before you judge.
- Inclusive language is the default. Use people's names and pronouns as they ask.

## Honesty

- Never misrepresent what our product does to a customer or prospect.
- Record expenses, time and data accurately.
- Declare conflicts of interest (a side business, a family member at a supplier) to your manager and People within 30 days.

## Gifts and hospitality

You may accept gifts and hospitality worth up to **100 GBP** per supplier per year. Anything above that must be declared in the "Something else" request in Help and approved by Tomás Herrera. Never accept cash.

## Protecting information

Follow the [Security policy](/knowledge/it/security-policy). Customer data never leaves approved systems.

## Speaking up

If you see something wrong, tell your manager, any member of the People team or use the anonymous form linked in #speak-up. We do not tolerate retaliation against anyone who raises a concern in good faith.

## Consequences

Breaking this code can lead to disciplinary action up to and including dismissal.`,
      },
      {
        slug: "benefits-overview",
        title: "Benefits overview",
        owner: "sofia.lindqvist",
        review: 40,
        verified: 140,
        updatedHoursAgo: 140 * 24,
        body: `What you get on top of salary. Exact providers differ by country; BambooHR shows yours.

## Pension and retirement

- **UK**: 6 percent employer contribution when you put in 4 percent, through salary sacrifice.
- **Germany**: company pension (bAV) with a 20 percent employer top-up.
- **US**: 401(k) with a 4 percent match.
- **India**: Provident Fund at the statutory rate plus gratuity.

## Health

Private medical insurance for you and your dependants in every country, plus an employee assistance programme with 8 free therapy sessions a year.

## Learning budget

**1,000 GBP** (or local equivalent) per person per calendar year for courses, books and conferences. Claim it through Expenses with the category "Learning". Unused budget does not roll over.

## Home office

A one-off 400 GBP home office allowance in your first three months, claimed through Expenses.

## Cycle to work and season tickets

Available in the UK and Germany through salary sacrifice. Raise a "Payroll question" in Help to join.`,
      },
      {
        slug: "performance-reviews",
        title: "Performance reviews",
        owner: "amara.nwosu",
        review: 60,
        verified: 120,
        updatedHoursAgo: 120 * 24,
        body: `We review performance twice a year, in April and October. Reviews are about growth first; pay decisions happen once a year, in April.

## How a cycle runs

1. **Week 1**: you write a self review in BambooHR (around 300 words: what you did, what you learned, what you want next).
2. **Week 2**: you pick two peers to give feedback; your manager may add one more.
3. **Week 3**: your manager writes their review and proposes a rating.
4. **Week 4**: calibration across each department, then your manager shares the outcome in a one-to-one.

## Ratings

| Rating | Meaning |
|---|---|
| Exceptional | Well beyond the level, shaping others' work |
| Strong | Fully at level and growing |
| Developing | Part way to the level; a clear plan is agreed |

## Promotions

Promotions are decided at the April and October calibrations. Your manager writes the case; the level guides in Notion describe what each level looks like.`,
      },
      {
        slug: "people-team",
        title: "The People team",
        owner: "priya.raman",
        template: "team",
        review: 90,
        verified: 30,
        updatedHoursAgo: 30 * 24,
        body: `## What we do

We look after hiring, onboarding, pay, leave, benefits, wellbeing and the office experience.

## Who we are

- Amara Nwosu, Chief People Officer
- Priya Raman, People Partner (Engineering, Product and Design)
- Sofia Lindqvist, People Operations Specialist (payroll, benefits, BambooHR)
- Marcus Reid, Talent Acquisition Lead
- Emily Ross, Office and Workplace Manager (London)
- Carlos Mendes, Workplace Coordinator (Austin)

## How to reach us

Raise a request in [Help](/help/new). We answer leave and payroll questions within one working day. For something sensitive, message any of us directly on Slack or book time in our calendars.`,
      },
    ],
  },
  {
    slug: "it",
    name: "IT",
    icon: "laptop",
    description: "Laptops, accounts, security and how to get technical help.",
    editors: ["it-team"],
    pages: [
      {
        slug: "security-policy",
        title: "Information security policy",
        owner: "anya.kowalski",
        template: "policy",
        review: 150,
        verified: 25,
        updatedHoursAgo: 25 * 24,
        body: `## Summary

Customers trust us with their production plans and supplier prices. This policy sets the minimum everyone must do to protect that data. We are ISO 27001 certified and audited every year; this policy is part of that certification.

## Who this applies to

Everyone with a Northwind Labs account, including contractors.

## Accounts and passwords

1. Use 1Password for every work password. Your master password is at least 14 characters and used nowhere else.
2. Multi-factor authentication is mandatory on Google Workspace, Slack, GitHub and every app in the Lobby launcher. See [Passwords and MFA](/knowledge/it/password-and-mfa).
3. Never share an account. If you need access, request it in [Apps](/apps).

## Devices

- Only company-managed laptops may access customer data. They are enrolled in device management, encrypted (FileVault or BitLocker) and lock after **5 minutes** idle.
- Install operating system updates within **7 days** of release. The device agent reminds you; after 14 days you lose access to Google Workspace until you update.
- Personal phones may use Slack and Gmail if they have a passcode and the latest major OS version.

## Data handling

| Classification | Examples | Where it may live |
|---|---|---|
| Public | Marketing site, published docs | Anywhere |
| Internal | Lobby pages, roadmaps | Company Google Drive, Notion, Slack |
| Confidential | Customer data, salaries, contracts | Approved systems only, shared with named people |

Never paste customer data into a personal AI tool or any tool not listed in Apps. The Lobby assistant is approved for internal data.

## Travel

Use the [VPN](/knowledge/it/vpn) on any network you do not control. Do not leave your laptop in a car or checked luggage.

## Reporting incidents

If you lose a device, click a suspicious link or see data where it should not be, report it **immediately** in #security-incidents or call the IT on-call number pinned there. Reporting fast is never punished.

## Exceptions

Exceptions are requested from Anya Kowalski, recorded and reviewed every 90 days.`,
      },
      {
        slug: "password-and-mfa",
        title: "Passwords and multi-factor authentication",
        owner: "alex.morgan",
        template: "how-to",
        parent: "security-policy",
        review: 100,
        verified: 80,
        updatedHoursAgo: 80 * 24,
        body: `Everything starts with your Google Workspace account: it is how you sign in to Lobby and to every app in the launcher.

## Before you start

- Your laptop, already set up (see [Setting up your laptop](/knowledge/it/laptop-setup))
- Your phone with the Google Authenticator or 1Password app installed
- The temporary password from your welcome email

## Set up your account

1. Go to accounts.google.com and sign in with your @northwind.example address and the temporary password.
2. Choose a new password of at least 14 characters. Save it in 1Password straight away.
3. When prompted, add a passkey on your laptop (Touch ID or Windows Hello). This is the fastest way to sign in.
4. Add a second method: your authenticator app. Scan the QR code and type the 6-digit code to confirm.
5. Print or save your 10 backup codes in 1Password under "Google backup codes".

## Set up 1Password

1. Accept the 1Password invite in your inbox.
2. Create your master password (14 characters or more, never written down outside 1Password's Emergency Kit).
3. Install the browser extension and the phone app.

## Resetting a forgotten password or a lost phone

:::warning
IT will never ask for your password or a code over Slack, email or phone. If someone does, report it in #security-incidents.
:::

Raise a "Password or MFA reset" request in [Help](/help/new) from a colleague's laptop if you are locked out. IT verifies your identity on a video call before resetting anything. Typical turnaround is under one hour in working hours.`,
      },
      {
        slug: "vpn",
        title: "Using the VPN",
        owner: "leila.haddad",
        template: "how-to",
        parent: "security-policy",
        review: -18,
        verified: 380,
        updatedHoursAgo: 380 * 24,
        body: `We use Tailscale as our VPN. You need it to reach internal tools (Grafana, staging environments, the build cache) and on any network you do not control: hotels, cafes, conferences, airports.

## Before you start

- A company-managed laptop
- Your Google Workspace account with MFA set up

## Steps

1. Open Self Service (Mac) or Company Portal (Windows) and install **Tailscale**.
2. Open Tailscale from the menu bar and choose "Log in".
3. Sign in with Google using your @northwind.example account.
4. Wait for the icon to show "Connected". Your laptop now appears in the admin console as yours.
5. Open grafana.internal.northwind.example to check: if the dashboard loads, you are on the VPN.

## Always-on

On public networks, turn on "Use exit node" and pick the nearest office (London, Frankfurt, Dallas or Mumbai). This routes all your traffic through the office.

## If something goes wrong

- **"Device not authorised"**: your laptop is not enrolled in device management. Raise a "VPN issue" request in Help.
- **Slow connection**: switch the exit node to a closer office or turn exit nodes off for video calls.

:::info
Still stuck? Raise a "VPN issue" request in [Help](/help/new) and include a screenshot of the Tailscale menu.
:::`,
      },
      {
        slug: "laptop-setup",
        title: "Setting up your laptop",
        owner: "jordan.blake",
        template: "how-to",
        review: 50,
        verified: 130,
        updatedHoursAgo: 130 * 24,
        body: `Your laptop arrives configured for you. Setup takes about 45 minutes; do it on a reliable connection, not on the train.

## Before you start

- Your laptop (engineers get a 16-inch MacBook Pro with 36 GB of memory; everyone else a 14-inch MacBook Air or a ThinkPad X1 Carbon)
- Your Google Workspace credentials from your welcome email
- Your phone

## Steps

1. Power on and join Wi-Fi. Choose "Northwind Labs" if you are in an office; otherwise your home network.
2. When asked, sign in with your @northwind.example Google account. This enrols the laptop in device management automatically. Do not skip this step.
3. Wait for the "Setup complete" notification (10 to 20 minutes). Required apps install on their own: Google Chrome, Slack, Zoom, 1Password, Tailscale and the security agent.
4. Set up passwords and MFA by following [Passwords and MFA](/knowledge/it/password-and-mfa).
5. Open Lobby and pin the apps you use from [Apps](/apps).
6. Engineers: continue with [Development environment](/knowledge/engineering/dev-environment).

## Check it worked

- FileVault (Mac) or BitLocker (Windows) shows as "On"
- Self Service or Company Portal opens and lists your apps
- You can sign in to Slack and Lobby

## Extra software

Install anything from Self Service without asking. For software not listed there, raise a "Software request" in Help; most requests are approved within one working day.

## Accessories

Every new starter can order a monitor, keyboard, mouse and headset. Raise a "New laptop" request in Help and choose "Accessories only".`,
      },
      {
        slug: "phishing",
        title: "Spotting and reporting phishing",
        owner: "anya.kowalski",
        template: "how-to",
        parent: "security-policy",
        review: 80,
        verified: 60,
        updatedHoursAgo: 60 * 24,
        body: `Phishing is the most common way attackers get in. We run a simulated phishing email every month; around 4 percent of people click, and we want that lower.

## Warning signs

- Urgency: "your account will be closed in 24 hours"
- A sender address that is nearly right (northwind-labs.co instead of northwind.example)
- Requests for gift cards, bank detail changes or codes
- Shared documents you were not expecting

## What to do

1. Do not click, reply or forward.
2. In Gmail, use the "Report phishing" button. It goes straight to the security team.
3. If you already clicked or entered a password, post in #security-incidents now and change your password.

Bank detail changes from suppliers are always confirmed by phone by the Finance team, using a number we already hold.`,
      },
      {
        slug: "it-team",
        title: "The IT team",
        owner: "alex.morgan",
        template: "team",
        review: 120,
        verified: 45,
        updatedHoursAgo: 45 * 24,
        body: `## What we do

Laptops, accounts, access to apps, the office network and security operations.

## Who we are

- Alex Morgan, Head of IT (London)
- Jordan Blake, IT Support Engineer (Austin)
- Leila Haddad, Systems Administrator (Berlin)
- Anya Kowalski, Security Engineer (remote)

## How to reach us

Raise a request in [Help](/help/new). We cover 08:00 to 18:00 UK time and 08:00 to 18:00 Austin time on working days.

| Priority | First response | Example |
|---|---|---|
| Urgent | 1 hour | Locked out, lost laptop, suspected breach |
| High | 4 working hours | Cannot use a core app |
| Normal | 1 working day | New software, accessories |

Out of hours, for security incidents only, call the number pinned in #security-incidents.`,
      },
    ],
  },
  {
    slug: "engineering",
    name: "Engineering",
    icon: "code",
    description: "How we build, ship and run the Northwind platform.",
    editors: ["engineering"],
    pages: [
      {
        slug: "dev-environment",
        title: "Development environment",
        owner: "maya.chen",
        template: "how-to",
        review: 8,
        verified: 172,
        updatedHoursAgo: 172 * 24,
        body: `How to get the Northwind platform running on your laptop. Expect about an hour, most of it downloads.

## Before you start

- Your laptop set up as described in [Setting up your laptop](/knowledge/it/laptop-setup)
- Access to the northwind-labs organisation on GitHub (request it in [Apps](/apps))
- Tailscale connected (see [Using the VPN](/knowledge/it/vpn)), for the build cache

## Steps

1. Install the toolchain manager and the pinned versions:

\`\`\`
brew install mise
mise install
\`\`\`

2. Clone the monorepo:

\`\`\`
git clone git@github.com:northwind-labs/platform.git
cd platform
\`\`\`

3. Start the local services (Postgres 17, Redis and the event bus):

\`\`\`
make services-up
\`\`\`

4. Install dependencies and seed demo data:

\`\`\`
pnpm install
make seed
\`\`\`

5. Run the app with \`make dev\` and open localhost:3000. Sign in with \`planner@demo.example\` and the password in 1Password under "Local demo planner".

## Check it worked

\`make check\` runs typecheck, lint and the unit tests. It should finish green in about 4 minutes on an M-series Mac.

## If something goes wrong

- **Port 5432 already in use**: another Postgres is running. Stop it with \`brew services stop postgresql\`.
- **Build cache errors**: you are not on the VPN.
- Ask in #eng-help. Someone usually answers within 15 minutes.`,
      },
      {
        slug: "on-call",
        title: "On-call",
        owner: "nikolai.petrov",
        review: 3,
        verified: 177,
        updatedHoursAgo: 177 * 24,
        body: `Engineers who have been here more than three months join the on-call rota. On-call is paid and we keep it humane.

## The rota

- Week-long shifts, handing over on Mondays at 10:00 UK time.
- One primary and one secondary. Primary acknowledges pages; secondary is backup if primary does not acknowledge in 10 minutes.
- Around 8 engineers per rota, so you are on call roughly once every two months.
- Swap shifts freely in PagerDuty; just tell #on-call.

## Pay

- **150 GBP** (or local equivalent) per week on call as primary, 75 GBP as secondary.
- Time off in lieu for any page answered between 22:00 and 07:00: half a day per night disturbed.

## What gets paged

Only customer-impacting alerts page: error rate above 2 percent for 5 minutes, planning job delays over 30 minutes, or the API being unreachable. Everything else goes to #alerts and waits for working hours. Dashboards live in Grafana under "Platform health".

## When you are paged

1. Acknowledge in PagerDuty within 10 minutes.
2. Open an incident channel with \`/incident new\` in Slack.
3. Follow [Incident response](/knowledge/engineering/incident-response).

## Handover

Write a short handover in #on-call every Monday: what paged, what is still open, what the next person should watch.`,
      },
      {
        slug: "incident-response",
        title: "Incident response",
        owner: "omar.farouk",
        parent: "on-call",
        review: 70,
        verified: 40,
        updatedHoursAgo: 40 * 24,
        body: `## Severity levels

| Severity | Meaning | Example | Update cadence |
|---|---|---|---|
| SEV1 | Many customers cannot use the product | API down, data loss | Every 30 minutes |
| SEV2 | Major feature broken for some customers | Planning runs failing for one region | Every hour |
| SEV3 | Minor impact, workaround exists | Slow exports | Daily |

## Roles

- **Incident lead**: coordinates, decides, does not debug. Usually the primary on-call.
- **Communications**: updates the status page and customer success. For SEV1, Mia Johansson or the Customer Success lead on duty.
- **Responders**: everyone else, debugging in the incident channel.

## Steps

1. Declare it: \`/incident new\`, pick a severity. When in doubt, pick the higher one.
2. Stop the bleeding before finding the cause: roll back, scale up, or turn off the feature flag.
3. Post updates on the cadence above, even when there is nothing new.
4. Close the incident when customer impact has ended.
5. Write a blameless review in Notion within **5 working days** for SEV1 and SEV2.`,
      },
      {
        slug: "code-review",
        title: "Code review guidelines",
        owner: "kenji.watanabe",
        review: 130,
        verified: 50,
        updatedHoursAgo: 50 * 24,
        body: `## For authors

- Keep pull requests under 400 changed lines where you can. Split refactors from behaviour changes.
- Write a description that says what changed, why, and how you tested it.
- Request one reviewer from your team. Changes to billing, auth or data deletion need a second reviewer from the Platform team.

## For reviewers

- Review within **one working day**. If you cannot, say so and suggest someone else.
- Label comments: \`nit:\` (optional), \`question:\` and \`blocking:\`. Only blocking comments stop a merge.
- Approve when it is better than what is there, not when it is perfect.

## Merging

Squash and merge once CI is green and you have an approval. The author merges, not the reviewer.`,
      },
      {
        slug: "deploying",
        title: "Deploying to production",
        owner: "omar.farouk",
        status: "draft",
        review: 90,
        verified: 0,
        updatedHoursAgo: 6,
        body: `## How deploys work

Every merge to main deploys to staging automatically. Production deploys run from Linear-linked releases, twice a day at 11:00 and 15:00 UK time.

## Rolling back

Draft: steps for rolling back with the deploy bot still to be written.`,
      },
    ],
  },
  {
    slug: "finance",
    name: "Finance",
    icon: "wallet",
    description: "Expenses, travel, payroll dates and buying things.",
    editors: ["finance"],
    pages: [
      {
        slug: "expenses-policy",
        title: "Expenses policy",
        owner: "ben.carter",
        template: "policy",
        review: 11,
        verified: 169,
        updatedHoursAgo: 169 * 24,
        body: `## Summary

Spend company money as if it were your own, on things that help the business. Claim it in the **Expenses** app within 30 days with a receipt, and you will be reimbursed in the next payroll run.

## Who this applies to

All employees. Contractors claim expenses through their invoice.

## Limits

| Category | Limit | Notes |
|---|---|---|
| Hotel, London or New York | 220 GBP per night | Includes breakfast and taxes |
| Hotel, elsewhere | 160 GBP per night | |
| Meals while travelling | 60 GBP per day | Alcohol is not reimbursed |
| Team meals | 40 GBP per person | Manager approval needed first |
| Client entertainment | 75 GBP per person | Name the client in the claim |
| Taxis | Any amount | Only when public transport is impractical or after 21:00 |
| Learning budget | 1,000 GBP per year | Category "Learning" |
| Home office | 400 GBP once | In your first three months |

Amounts are in GBP; use the local equivalent in other countries. The Expenses app converts at the day's rate.

## Travel

Book flights and trains in Expenses' travel booking. Economy for flights under 6 hours; premium economy for longer. Trains in standard class.

## How to claim

1. Open the **Expenses** app from [Apps](/apps).
2. Photograph the receipt or forward the email receipt to receipts@northwind.example.
3. Choose the category, add a one-line reason and submit.
4. Your manager approves; Finance checks it and pays it in the next payroll run (the 25th).

Claims over **500 GBP** also need approval from Ben Carter. Claims submitted more than 90 days after the spend are not paid.

## Company cards

Managers and frequent travellers can request a company card. Every card transaction still needs a receipt in Expenses within 7 days.

## Questions

Raise an "Expense question" request in [Help](/help/new).`,
      },
      {
        slug: "payroll-dates",
        title: "Payroll dates and payslips",
        owner: "fatima.zahra",
        review: -32,
        verified: 395,
        updatedHoursAgo: 395 * 24,
        body: `## When you are paid

On the 25th of each month, or the last working day before it when the 25th falls on a weekend or public holiday.

## Cut-off dates

Changes to pay (overtime, expenses, bank details) must reach Finance by the **15th** to be included that month.

## Payslips

Payslips are published in BambooHR on the 22nd. P60s (UK) arrive by 31 May and Lohnsteuerbescheinigungen (Germany) by the end of February.

## Changing your bank details

Update them in BambooHR. Finance confirms every change by phone before it takes effect, so allow five working days.`,
      },
      {
        slug: "buying-software",
        title: "Buying software and services",
        owner: "tomas.herrera",
        review: 85,
        verified: 95,
        updatedHoursAgo: 95 * 24,
        body: `## Under 1,000 GBP a year

Pay with a company card if you have one, or ask your manager to. Tell IT by raising a "Software request" in Help so it is added to the app catalogue.

## 1,000 to 25,000 GBP a year

Raise a "Software request" in Help. IT reviews security, Finance reviews the contract. Allow two weeks.

## Over 25,000 GBP a year

Needs a short business case and approval from Tomás Herrera. Allow four weeks, because legal and security reviews run in parallel.

## Contracts

Only Tomás Herrera and Elena Vasquez may sign contracts. Never click "I agree" on terms for a paid service on the company's behalf.`,
      },
    ],
  },
  {
    slug: "workplace",
    name: "Workplace",
    icon: "map-pin",
    description: "Our offices, desks, visitors and getting around.",
    editors: ["facilities"],
    pages: [
      {
        slug: "london-office",
        title: "London office guide",
        owner: "emily.ross",
        review: 45,
        verified: 135,
        updatedHoursAgo: 135 * 24,
        body: `Our headquarters, on the 4th floor of 12 Clerkenwell Green, London EC1R 0DP. Around 55 people are based here.

## Getting in

- The building is open 07:00 to 21:00 on weekdays. Use your access card at the ground floor gates.
- New starters collect their card from reception on day one. Lost card? Raise a "Building access" request in [Help](/help/new); a temporary pass is ready the same day.
- Farringdon station (Elizabeth line, Thameslink, Circle, Hammersmith and City, Metropolitan) is a 4 minute walk.

## Desks

There are 48 desks and 6 meeting rooms. Book a desk in the desk booking tool on anchor days (Tuesday and Thursday). Engineering sits by the windows; People and Finance near the kitchen. Each desk has a 27-inch monitor and a USB-C dock.

## Meeting rooms

| Room | Seats | Kit |
|---|---|---|
| Thames | 12 | Zoom Rooms, whiteboard wall |
| Fleet | 6 | Zoom Rooms |
| Walbrook | 4 | Screen only |
| Phone booths (x4) | 1 | Quiet, no booking needed |

## Food and drink

Breakfast is provided on Tuesdays and Thursdays from 08:30. Fruit, coffee and tea are always free. Thursday all-hands is followed by drinks in the kitchen.

## Visitors

Register visitors in the reception iPad at least a day ahead. They must be met at reception and accompanied at all times.

## Bikes and showers

Secure bike storage for 20 bikes in the basement (code from Emily Ross). Two showers and lockers on the ground floor.

## Fire and first aid

Fire alarm tests are on Wednesdays at 10:00. Assembly point: Clerkenwell Green, by the Marx Memorial Library. First aiders: Emily Ross, Ben Carter and Chloe Martin.`,
      },
      {
        slug: "berlin-office",
        title: "Berlin office guide",
        owner: "emily.ross",
        review: 100,
        verified: 80,
        updatedHoursAgo: 80 * 24,
        body: `Our Berlin office is at Torstrasse 140, 10119 Berlin, a short walk from Rosenthaler Platz (U8). Around 30 people work here, mostly Engineering and Product.

## Getting in

Doors open 08:00 to 20:00. Access cards come from Leila Haddad on your first day.

## Desks and rooms

24 desks, 3 meeting rooms (Spree, Havel, Wannsee) and two phone booths. Anchor days are Tuesday and Wednesday.

## Food

Lunch together on Wednesdays, paid by the company. Coffee from the espresso machine is free; please descale it on Fridays.`,
      },
      {
        slug: "desk-booking",
        title: "Booking a desk",
        owner: "carlos.mendes",
        template: "how-to",
        review: 115,
        verified: 65,
        updatedHoursAgo: 65 * 24,
        body: `## Steps

1. Open the desk booking tool from [Apps](/apps).
2. Choose your office and the day.
3. Pick a desk on the floor plan. Team zones are shaded.
4. Check in on arrival by scanning the QR code on the desk. Bookings without a check-in by 11:00 are released.

## Rules

- Book up to 4 weeks ahead.
- At most 3 days a week, so everyone gets a turn on anchor days.
- Need a fixed desk for an accessibility reason? Raise a "Desk booking" request in [Help](/help/new); it is always granted.`,
      },
    ],
  },
  {
    slug: "people-confidential",
    name: "People team only",
    icon: "lock",
    description: "Pay, calibration and sensitive process notes. Visible to the People team only.",
    editors: ["people-team"],
    visibleTo: ["people-team"],
    pages: [
      {
        slug: "salary-bands-2026",
        title: "Salary bands 2026",
        owner: "amara.nwosu",
        review: 120,
        verified: 60,
        updatedHoursAgo: 60 * 24,
        body: `:::warning
Confidential. Do not share outside the People team. Managers see the band for a role only when making an offer or a promotion case.
:::

Bands were set in March 2026 from our external pay benchmark at the 60th percentile, then adjusted per location. Ranges are base salary only.

## Engineering, London (GBP)

| Level | Title | Minimum | Midpoint | Maximum |
|---|---|---|---|---|
| L2 | Software Engineer | 58,000 | 66,000 | 74,000 |
| L3 | Senior Software Engineer | 76,000 | 87,000 | 98,000 |
| L4 | Staff Engineer | 100,000 | 115,000 | 130,000 |
| M1 | Engineering Manager | 98,000 | 112,000 | 126,000 |

## Location multipliers

| Office | Multiplier |
|---|---|
| London | 1.00 |
| Berlin | 0.92 (paid in EUR) |
| Austin | 1.15 (paid in USD) |
| Bengaluru | 0.38 (paid in INR) |
| Remote | Nearest office |

## Rules

- Offers above midpoint need Amara Nwosu's approval.
- Nobody is paid below the band minimum: anyone who falls below after a band change is raised at the next payroll.
- The annual pay review budget for April 2026 is 4.5 percent of base payroll.`,
      },
      {
        slug: "calibration-notes",
        title: "Calibration process notes",
        owner: "priya.raman",
        review: 9,
        verified: 171,
        updatedHoursAgo: 171 * 24,
        body: `Private notes for running calibration sessions.

## Before the session

- Export draft ratings from BambooHR into the calibration sheet.
- Flag anyone with a rating change of two steps, anyone on leave during the cycle, and anyone who has not had a promotion conversation in 18 months.

## In the session

- Each manager gets 3 minutes per report. Evidence, not adjectives.
- Watch the distribution: we expect roughly 15 percent Exceptional, 70 percent Strong and 15 percent Developing, but never force it.

## After

Record outcomes in BambooHR within two working days, then managers share them in one-to-ones.`,
      },
    ],
  },
];

/** Seeds the knowledge module for the Northwind Labs demo. Idempotent: deletes its own rows first. */
export async function seedKnowledge(ctx: SeedContext): Promise<void> {
  const oldSpaces = await db.select({ id: s.spaces.id }).from(s.spaces);
  if (oldSpaces.length) {
    // Pages, versions and acknowledgements cascade from spaces.
    await db.delete(s.spaces).where(inArray(s.spaces.id, oldSpaces.map((x) => x.id)));
  }
  await db.delete(s.searchChunks).where(eq(s.searchChunks.sourceType, "page"));

  for (const [order, sp] of SPACES.entries()) {
    const [space] = await db
      .insert(s.spaces)
      .values({
        slug: sp.slug,
        name: sp.name,
        icon: sp.icon,
        description: sp.description,
        editorGroupIds: sp.editors.map((g) => ctx.group(g)),
        visibilityGroupIds: (sp.visibleTo ?? []).map((g) => ctx.group(g)),
        sortOrder: order,
      })
      .returning();
    const idBySlug = new Map<string, string>();
    // Parents first, so children can point at them.
    const ordered = [...sp.pages].sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
    for (const p of ordered) {
      const doc = markdownToDoc(p.body) as DocNode;
      const status = p.status ?? "published";
      const updatedAt = hoursAgo(p.updatedHoursAgo);
      const verifiedAt = status === "published" ? hoursAgo(p.verified * 24) : null;
      const [page] = await db
        .insert(s.pages)
        .values({
          spaceId: space!.id,
          parentId: p.parent ? idBySlug.get(p.parent) ?? null : null,
          slug: p.slug,
          title: p.title,
          content: doc as unknown as Record<string, unknown>,
          contentText: docToText(doc),
          template: p.template ?? "blank",
          ownerId: ctx.user(p.owner),
          status,
          reviewBy: daysFromToday(p.review),
          verifiedAt,
          verifiedById: verifiedAt ? ctx.user(p.owner) : null,
          publishedAt: status === "published" ? hoursAgo(Math.max(p.updatedHoursAgo, p.verified * 24) + 24 * 30) : null,
          createdAt: hoursAgo(Math.max(p.updatedHoursAgo, p.verified * 24) + 24 * 30),
          updatedAt,
        })
        .returning({ id: s.pages.id });
      idBySlug.set(p.slug, page!.id);

      if (status === "published") {
        const versions = [
          ...(p.history ?? []).map(([title, md, daysAgo]) => ({
            pageId: page!.id,
            title,
            content: markdownToDoc(md) as unknown as Record<string, unknown>,
            authorId: ctx.user(p.owner),
            createdAt: hoursAgo(daysAgo * 24),
          })),
          { pageId: page!.id, title: p.title, content: doc as unknown as Record<string, unknown>, authorId: ctx.user(p.owner), createdAt: updatedAt },
        ];
        await db.insert(s.pageVersions).values(versions);
      }
    }
  }

  // A few people have already acknowledged the code of conduct and the security policy.
  const ackers = ["grace.okoye", "nikolai.petrov", "chloe.martin", "kenji.watanabe", "aisha.bello", "ben.carter", "emily.ross", "priya.raman"];
  const policyPages = await db
    .select({ id: s.pages.id, slug: s.pages.slug })
    .from(s.pages)
    .where(inArray(s.pages.slug, ["code-of-conduct", "security-policy"]));
  await db.insert(s.pageAcknowledgements).values(
    policyPages.flatMap((pg) => ackers.map((u, i) => ({ pageId: pg.id, userId: ctx.user(u), createdAt: hoursAgo(24 * (3 + i * 4)) }))),
  ).onConflictDoNothing();
}
