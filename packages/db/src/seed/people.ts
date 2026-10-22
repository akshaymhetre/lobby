import { eq } from "drizzle-orm";
import { db } from "../client";
import * as s from "../schema/index";
import { DEMO_DOMAIN, type SeedContext } from "./util";

interface Enrichment {
  pronouns?: string;
  bio: string;
  skills: string[];
  phone?: string;
}

/** Profile detail for the demo company, keyed by username. Updates only; base.ts owns the rows. */
const PROFILES: Record<string, Enrichment> = {
  "elena.vasquez": {
    pronouns: "she/her",
    bio: "Started Northwind in a spare room in Hackney with two engineers and a whiteboard. These days I spend most of my time with customers and on hiring. Happy to talk about anything, my calendar has open office hours on Thursdays.",
    skills: ["Strategy", "Fundraising", "Customer development", "Hiring"],
    phone: "+44 20 7946 0101",
  },
  "david.kim": {
    pronouns: "he/him",
    bio: "I look after engineering, security and IT. Before Northwind I built payments infrastructure for a decade. I still review the occasional pull request and I am always up for an architecture chat over coffee in Berlin.",
    skills: ["Distributed systems", "Platform strategy", "Security", "Go", "Postgres"],
    phone: "+49 30 901820",
  },
  "amara.nwosu": {
    pronouns: "she/her",
    bio: "Chief People Officer. I care about making Northwind a place where people do the best work of their careers and still make it to dinner. Ask me about career frameworks, parental leave or how we hire.",
    skills: ["People strategy", "Org design", "Coaching", "Compensation"],
  },
  "tomas.herrera": {
    pronouns: "he/him",
    bio: "I run finance: planning, accounting, payroll and our board reporting. Spreadsheets are a love language. If an expense policy is confusing, tell me and I will fix the policy.",
    skills: ["Financial planning", "Fundraising", "Board reporting", "SaaS metrics"],
  },
  "hannah.becker": {
    pronouns: "she/her",
    bio: "VP of Sales and Marketing, based in Austin. I spent my early career as a solutions engineer, so I still enjoy a good technical demo. Outside work: trail running and terrible puns.",
    skills: ["Go-to-market", "Enterprise sales", "Brand", "Pricing"],
  },
  "rohan.mehta": {
    pronouns: "he/him",
    bio: "VP Product in Bengaluru. I like small teams, short documents and talking to customers every week. Our roadmap lives in Linear and I am happy to walk anyone through it.",
    skills: ["Product strategy", "Roadmapping", "User research", "Analytics"],
  },
  "alex.morgan": {
    pronouns: "they/them",
    bio: "Head of IT. If something with your laptop, an app or access is broken, raise a request in Help and my team will be on it. I also run Lobby itself, so feedback on this intranet comes to me.",
    skills: ["Identity and SSO", "Device management", "Okta", "Google Workspace", "Security"],
    phone: "+44 20 7946 0144",
  },
  "jordan.blake": {
    pronouns: "he/him",
    bio: "IT support in Austin. Laptops, monitors, the conference room screens that never cooperate: that is me. Usually around 8 to 4 Central.",
    skills: ["Hardware support", "macOS", "Jamf", "Zoom Rooms"],
  },
  "leila.haddad": {
    pronouns: "she/her",
    bio: "Systems administrator in Berlin, keeping our SaaS estate tidy and our access reviews on time. I automate anything I have to do twice.",
    skills: ["Automation", "SCIM provisioning", "Bash", "Terraform", "Access reviews"],
  },
  "priya.raman": {
    pronouns: "she/her",
    bio: "People partner for Engineering and Product. I help with performance, growth conversations, leave, and anything that feels tricky to raise. Everything you tell me stays confidential unless you say otherwise.",
    skills: ["Employee relations", "Performance", "Leave policy", "Coaching"],
  },
  "marcus.reid": {
    pronouns: "he/him",
    bio: "I lead talent acquisition. If you know someone great, send them my way: referrals are the best hires we make. Based in Austin, recruiting everywhere.",
    skills: ["Recruiting", "Employer brand", "Interview training", "Greenhouse"],
  },
  "sofia.lindqvist": {
    pronouns: "she/her",
    bio: "People operations in London. Contracts, onboarding, benefits and the paperwork that keeps it all running. I wrote most of the onboarding journeys in Lobby.",
    skills: ["Onboarding", "Benefits", "HRIS", "Process design"],
  },
  "maya.chen": {
    pronouns: "she/her",
    bio: "Senior engineer on the Platform team, mostly working on our data pipeline and the internal developer tooling. I care a lot about good error messages. Ask me about Postgres or Rust.",
    skills: ["Rust", "Postgres", "TypeScript", "Kubernetes", "Developer experience"],
    phone: "+49 30 901844",
  },
  "nikolai.petrov": {
    pronouns: "he/him",
    bio: "Engineering manager for Platform. My team owns infrastructure, the data pipeline and on-call tooling. I run a monthly reliability review that anyone can join.",
    skills: ["Engineering management", "Reliability", "Incident response", "Kubernetes"],
  },
  "grace.okoye": {
    pronouns: "she/her",
    bio: "Engineering manager for the Product team in London. We build the parts of Northwind customers click on. I am a big believer in pairing and in shipping small.",
    skills: ["Engineering management", "React", "Hiring", "Mentoring"],
    phone: "+44 20 7946 0172",
  },
  "kenji.watanabe": {
    pronouns: "he/him",
    bio: "Staff engineer, fully remote from Osaka. I work across teams on architecture and the hard performance problems. Happy to review a design doc any time.",
    skills: ["System design", "Performance", "Go", "Postgres", "Event sourcing"],
  },
  "isabel.duarte": {
    pronouns: "she/her",
    bio: "Software engineer on Platform, working on our job scheduler. Previously a physics researcher, so I like a good graph.",
    skills: ["Python", "TypeScript", "Observability", "Data modelling"],
  },
  "arjun.iyer": {
    pronouns: "he/him",
    bio: "Engineer on the Product team in Bengaluru. Mostly frontend these days, with the occasional API. I organise our monthly lunch-and-learn.",
    skills: ["React", "TypeScript", "Accessibility", "GraphQL"],
  },
  "chloe.martin": {
    pronouns: "she/her",
    bio: "Senior frontend engineer. I maintain our design system with Yuki and Noah, and I will happily nerd out about focus states.",
    skills: ["Design systems", "React", "CSS", "Accessibility", "Testing"],
  },
  "omar.farouk": {
    bio: "Site reliability engineer, remote from Lisbon. I look after our cloud, observability and on-call rota. If an alert woke you up and was not useful, tell me.",
    skills: ["AWS", "Terraform", "Observability", "Incident response", "Linux"],
  },
  "lucy.zhang": {
    pronouns: "she/her",
    bio: "QA engineer. I write the end-to-end tests that catch things before customers do, and I run our release checklist.",
    skills: ["Test automation", "Playwright", "Exploratory testing", "Release management"],
  },
  "sam.okafor": {
    pronouns: "he/him",
    bio: "Software engineer joining the Product team. Excited to meet everyone. Previously at a fintech start-up in Lagos and London.",
    skills: ["TypeScript", "Node.js", "React"],
  },
  "noah.fischer": {
    pronouns: "he/him",
    bio: "Product designer working on onboarding and settings. I sketch on paper first and I love a messy usability session.",
    skills: ["Interaction design", "Figma", "Prototyping", "User research"],
  },
  "aisha.bello": {
    pronouns: "she/her",
    bio: "Senior product manager for our integrations. I talk to a customer most days and write everything down in Notion.",
    skills: ["Product management", "Integrations", "APIs", "Discovery"],
  },
  "mateo.rossi": {
    pronouns: "he/him",
    bio: "Product manager, remote from Milan. I work on reporting and analytics. Ask me about SQL or the best espresso in any city.",
    skills: ["Product management", "SQL", "Analytics", "Experimentation"],
  },
  "yuki.tanaka": {
    pronouns: "she/her",
    bio: "Design lead. I look after the product design team, our design system and how Northwind looks and sounds everywhere.",
    skills: ["Design leadership", "Design systems", "Brand", "Figma", "Writing"],
  },
  "ben.carter": {
    pronouns: "he/him",
    bio: "Financial controller. Month-end close, audits and making sure suppliers get paid on time. Questions about expenses or invoices land with me.",
    skills: ["Accounting", "Month-end close", "Audit", "Xero"],
  },
  "fatima.zahra": {
    pronouns: "she/her",
    bio: "Accounts payable in Bengaluru. Send invoices to the finance inbox and I will take it from there.",
    skills: ["Accounts payable", "Vendor management", "Reconciliation"],
  },
  "daniel.osei": {
    pronouns: "he/him",
    bio: "FP&A analyst. I build the models behind our budget and headcount plans. Always looking for an excuse to make a chart.",
    skills: ["Financial modelling", "Forecasting", "SQL", "Excel"],
  },
  "olivia.brooks": {
    pronouns: "she/her",
    bio: "Account executive covering mid-market customers in North America. I like long discovery calls and short contracts.",
    skills: ["Sales", "Negotiation", "Salesforce", "Discovery"],
  },
  "ethan.wright": {
    pronouns: "he/him",
    bio: "Head of Sales. I look after our account executives, solutions engineers and customer success. Ask me for a deal review any time.",
    skills: ["Sales leadership", "Forecasting", "Enterprise sales", "Coaching"],
  },
  "zara.ahmed": {
    pronouns: "she/her",
    bio: "Content marketing. Blog, newsletter, case studies and the occasional webinar. If you shipped something cool, I want to write about it.",
    skills: ["Writing", "Content strategy", "SEO", "Editing"],
  },
  "lukas.novak": {
    pronouns: "he/him",
    bio: "Solutions engineer in Berlin. I run technical evaluations with prospects and build the demos. Former backend developer.",
    skills: ["Solution architecture", "APIs", "Demos", "Python"],
  },
  "mia.johansson": {
    pronouns: "she/her",
    bio: "Customer success manager for our UK and Nordic customers. I turn customer feedback into tickets the product team can actually use.",
    skills: ["Customer success", "Onboarding", "Renewals", "Training"],
  },
  "ravi.shankar": {
    pronouns: "he/him",
    bio: "Data engineer on Platform, just joined. Working on the warehouse and our event pipeline. Say hi, I am still learning where everything lives.",
    skills: ["Python", "dbt", "Airflow", "SQL", "Spark"],
  },
  "emily.ross": {
    pronouns: "she/her",
    bio: "Office and workplace manager. Desks, building passes, the kitchen and every office event. The London office is my second home.",
    skills: ["Workplace operations", "Events", "Vendor management", "Health and safety"],
    phone: "+44 20 7946 0190",
  },
  "carlos.mendes": {
    pronouns: "he/him",
    bio: "Workplace coordinator for the Austin office, new to Northwind this month. Building passes and desk bookings come to me.",
    skills: ["Workplace operations", "Facilities", "Spanish"],
  },
  "anya.kowalski": {
    pronouns: "she/her",
    bio: "Security engineer, remote from Krakow. I run our security reviews, phishing drills and the vulnerability programme. Report anything suspicious, there are no silly questions.",
    skills: ["Application security", "Threat modelling", "Cloud security", "Incident response"],
  },
  "felix.wagner": {
    pronouns: "he/him",
    bio: "Marketing designer joining in Berlin. Illustration, campaigns and making slides look less like slides.",
    skills: ["Illustration", "Brand design", "Figma", "Motion"],
  },
  "nora.sullivan": {
    pronouns: "she/her",
    bio: "Executive assistant to Elena and the leadership team. If you need time with leadership or help with an offsite, I am your person.",
    skills: ["Scheduling", "Event planning", "Travel", "Board logistics"],
  },
};

/**
 * Enriches demo profiles (bios, skills, pronouns, a few phone numbers) after base.ts creates the
 * people. Idempotent: it only updates rows by email, so it can be re-run with `seed:one people`.
 */
export async function seedPeople(_ctx: SeedContext): Promise<void> {
  let n = 0;
  for (const [username, p] of Object.entries(PROFILES)) {
    const rows = await db
      .update(s.users)
      .set({ pronouns: p.pronouns ?? null, bio: p.bio, skills: p.skills, phone: p.phone ?? null })
      .where(eq(s.users.email, `${username}@${DEMO_DOMAIN}`))
      .returning({ id: s.users.id });
    n += rows.length;
  }
  console.log(`people: enriched ${n} profiles`);
}
