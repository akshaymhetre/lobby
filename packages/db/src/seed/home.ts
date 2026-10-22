import { db } from "../client";
import * as s from "../schema/index";
import { hoursAgo, type SeedContext } from "./util";

const days = (n: number) => n * 24;
const inDays = (n: number) => new Date(Date.now() + n * 24 * 3600_000);

interface SeedPost {
  key: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  author: string;
  audience?: string[];
  pinned?: boolean;
  hoursAgo: number;
  likes: string[];
  saves?: string[];
  comments: [string, string, number][];
}

const POSTS: SeedPost[] = [
  {
    key: "q3",
    title: "Q3 at Northwind: what we shipped and where we go next",
    summary: "Revenue up 31%, two big launches, and three priorities for the rest of the year.",
    category: "Company",
    author: "elena.vasquez",
    pinned: true,
    hoursAgo: days(2) + 3,
    body: `<p>Thank you, all of you, for a quarter we will remember. Here is the short version of what I shared at Thursday's all-hands, for anyone who missed it or wants the numbers in writing.</p>
<h2>What went well</h2>
<ul><li>Revenue grew 31% on last year, and net retention passed 118% for the first time.</li><li>We shipped workflow automations and the new reporting suite, both ahead of plan.</li><li>Customer satisfaction held at 4.7 out of 5 through the busiest support quarter we have had.</li></ul>
<h2>What we are changing</h2>
<p>We grew faster than our processes. Planning across Product and Engineering will move to a six-week cycle from November, and every team will publish a one-page plan in Knowledge so the rest of us can see it.</p>
<h2>Three priorities for Q4</h2>
<ol><li>Make onboarding for new customers take days, not weeks.</li><li>Open the Berlin office and keep hiring carefully.</li><li>Pay down the reliability debt we took on to hit the launches.</li></ol>
<p>Questions are very welcome, in the comments here or in my office hours on Tuesdays.</p>`,
    likes: ["david.kim", "amara.nwosu", "maya.chen", "grace.okoye", "rohan.mehta", "priya.raman", "kenji.watanabe", "zara.ahmed", "nora.sullivan", "ben.carter", "hannah.becker"],
    saves: ["grace.okoye"],
    comments: [
      ["david.kim", "Proud of this team. The reliability work in Q4 is going to make next year a lot calmer.", days(2)],
      ["maya.chen", "Six-week cycles will help a lot. Will the plans template live in the Engineering space?", days(2) - 2],
      ["elena.vasquez", "Yes, Rohan is putting it in Company so every team uses the same one.", days(1) + 20],
    ],
  },
  {
    key: "berlin",
    title: "Our new Berlin office opens on 2 November",
    summary: "Forty desks, two quiet rooms and a kitchen that finally fits everyone. Here is how the move works.",
    category: "Workplace",
    author: "emily.ross",
    hoursAgo: days(1) + 5,
    body: `<p>After eighteen months of borrowed meeting rooms, the Berlin team gets a home of its own. The new office is at Torstraße 140, a five-minute walk from Rosenthaler Platz.</p>
<h2>What to expect</h2>
<ul><li>Forty bookable desks, two quiet rooms and four meeting rooms with video kits.</li><li>Step-free access, showers and bike parking for twenty.</li><li>Building access cards are being printed now. Request yours through Help if you have not already.</li></ul>
<p>The old co-working space closes on Friday 30 October. Leila and the IT team will move monitors and docks over that weekend, so please clear your desk by Thursday evening.</p>`,
    likes: ["nikolai.petrov", "maya.chen", "isabel.duarte", "noah.fischer", "lukas.novak", "leila.haddad", "david.kim"],
    comments: [
      ["noah.fischer", "Bike parking for twenty is the best news I have had all month.", days(1) + 2],
      ["isabel.duarte", "Is there a plan for the plants from the old space?", days(1)],
      ["emily.ross", "They are coming with us. Leila has already claimed the big monstera.", 20],
    ],
  },
  {
    key: "ci",
    title: "How we cut CI time in half without buying bigger machines",
    summary: "Test sharding, a warm dependency cache and one embarrassing Docker layer. Notes from the platform team.",
    category: "Engineering",
    author: "omar.farouk",
    hoursAgo: days(4),
    body: `<p>In August a full CI run on the main repository took 24 minutes. Today the median is 11. We did not add hardware. Here is what actually moved the number.</p>
<h2>1. Shard tests by measured duration</h2>
<p>We split the suite into eight shards balanced by how long each file took over the last 50 runs, not by file count. The slowest shard went from 14 minutes to 5.</p>
<h2>2. Keep the dependency cache warm</h2>
<p>Every branch used to restore the cache from main, miss, and reinstall. Keying the cache on the lockfile hash alone took installs from 3 minutes to 20 seconds.</p>
<h2>3. The Docker layer we should have fixed years ago</h2>
<p>We copied the whole repository before installing dependencies, so every commit invalidated the install layer. Copying the lockfile first saved four minutes per image build.</p>
<p>Full write-up and dashboards are in Grafana under <em>CI health</em>. Questions to #platform.</p>`,
    audience: ["engineering"],
    likes: ["maya.chen", "kenji.watanabe", "nikolai.petrov", "chloe.martin", "arjun.iyer", "lucy.zhang", "david.kim", "ravi.shankar"],
    saves: ["maya.chen", "arjun.iyer"],
    comments: [
      ["kenji.watanabe", "The lockfile-first trick deserves a lint rule so nobody undoes it.", days(4) - 3],
      ["omar.farouk", "Good idea. I will add a check to the Dockerfile linter this sprint.", days(4) - 5],
      ["lucy.zhang", "Flaky test rate dropped too, which I did not expect. Sharding by duration exposed two order-dependent tests.", days(3)],
    ],
  },
  {
    key: "benefits",
    title: "Changes to our benefits from 1 January",
    summary: "More parental leave, a bigger learning budget and a simpler pension match.",
    category: "People",
    author: "amara.nwosu",
    hoursAgo: days(6),
    body: `<p>We listened to the engagement survey and to many of you directly. From 1 January three things change for everyone at Northwind.</p>
<ul><li><strong>Parental leave</strong> goes to 20 weeks at full pay for every parent, however your family grows.</li><li><strong>Learning budget</strong> rises to 1,500 a year in your local currency, and now covers conferences.</li><li><strong>Pension</strong> matching becomes a flat 6% in every country we employ people.</li></ul>
<p>The full details are in the <a href="/knowledge/people/parental-leave">parental leave policy</a> and the employee handbook. Priya and Sofia are running two drop-in sessions next week if you want to talk through your situation.</p>`,
    likes: ["maya.chen", "grace.okoye", "priya.raman", "sofia.lindqvist", "chloe.martin", "olivia.brooks", "mia.johansson", "daniel.osei", "fatima.zahra", "yuki.tanaka", "omar.farouk", "arjun.iyer", "aisha.bello"],
    saves: ["maya.chen", "grace.okoye", "chloe.martin"],
    comments: [
      ["grace.okoye", "This is a genuinely big deal. Thank you for pushing for it.", days(6) - 2],
      ["daniel.osei", "Does the learning budget roll over if unused?", days(5)],
      ["priya.raman", "Not this year, but up to 500 can be carried into the first quarter. It is in the handbook now.", days(5) - 4],
    ],
  },
  {
    key: "joiners",
    title: "Say hello to our October joiners",
    summary: "Four new faces across Engineering, People and Marketing this month.",
    category: "People",
    author: "priya.raman",
    hoursAgo: days(3) + 2,
    body: `<p>October is a big month for new starters. Please give them a warm welcome, and use the <em>Say hi</em> button on the home page if you have not met yet.</p>
<ul><li><strong>Ravi Shankar</strong> joined as a Data Engineer in Bengaluru, working on the analytics pipeline.</li><li><strong>Carlos Mendes</strong> joined Workplace in Austin and is already the person to ask about desks.</li><li><strong>Sam Okafor</strong> starts tomorrow as a Software Engineer on Grace's team in London.</li><li><strong>Felix Wagner</strong> starts at the end of the month as our Marketing Designer in Berlin.</li></ul>`,
    likes: ["grace.okoye", "maya.chen", "carlos.mendes", "ravi.shankar", "emily.ross", "marcus.reid", "amara.nwosu"],
    comments: [
      ["ravi.shankar", "Thank you all for the welcome. Two weeks in and I have already broken the staging pipeline once.", days(3)],
      ["omar.farouk", "Rite of passage. Welcome, Ravi.", days(3) - 1],
    ],
  },
  {
    key: "allhands",
    title: "All-hands recap: September",
    summary: "Slides, recording and the five questions we ran out of time for.",
    category: "Company",
    author: "nora.sullivan",
    hoursAgo: days(9),
    body: `<p>Thanks to everyone who joined in London, Berlin, Austin, Bengaluru and on the call. The recording and slides are in the Company space.</p>
<h2>The questions we did not get to</h2>
<p><strong>Will we hire in Bengaluru next year?</strong> Yes. Rohan will share the plan in November.</p>
<p><strong>Is there a budget for team offsites?</strong> Each team has one offsite a year. Ask your manager to book it through Workplace.</p>
<p><strong>When do we get the new laptops?</strong> Refreshes are rolling through IT now. Anyone on a 2022 machine will hear from Jordan by the end of October.</p>`,
    likes: ["elena.vasquez", "maya.chen", "mateo.rossi", "zara.ahmed"],
    comments: [["mateo.rossi", "Thanks for writing these up, Nora. Helpful for those of us on the late call.", days(8)]],
  },
  {
    key: "bengaluru",
    title: "Meet the Bengaluru team",
    summary: "Nine people, three time zones of overlap and the best filter coffee in the company.",
    category: "Culture",
    author: "rohan.mehta",
    hoursAgo: days(12),
    body: `<p>Our Bengaluru office turned two this month. It started with Yuki, Arjun and me in a borrowed room and is now home to nine people across Product, Engineering, Finance and People.</p>
<p>We overlap with Berlin and London for most of the working day, which makes Bengaluru the natural home for follow-the-sun support and on-call. If you are ever in town, the coffee is on us.</p>`,
    likes: ["yuki.tanaka", "arjun.iyer", "lucy.zhang", "fatima.zahra", "priya.raman"],
    comments: [],
  },
  {
    key: "sales",
    title: "Q4 sales kickoff: targets, territories and our biggest win yet",
    summary: "What the new territory plan means for each of you, and the story behind the Halcyon deal.",
    category: "Sales",
    author: "hannah.becker",
    hoursAgo: days(5),
    audience: ["sales-marketing", "leadership"],
    body: `<p>Q4 targets are in Salesforce now. The big change is territories: Ethan's team takes North America end to end, and Lukas leads solutions for EMEA.</p>
<p>Huge congratulations to Olivia for closing Halcyon Freight, our largest new customer to date, after a nine-month cycle.</p>`,
    likes: ["ethan.wright", "olivia.brooks", "lukas.novak", "elena.vasquez"],
    comments: [["ethan.wright", "Olivia, that was a masterclass. Drinks on me in Austin.", days(5) - 3]],
  },
];

/** Owns announcements, posts (and their comments, reactions, saves), home cards and greetings. */
export async function seedHome(ctx: SeedContext): Promise<void> {
  const known = (u: string) => ctx.userIdByUsername.has(u);
  const uid = (u: string) => (known(u) ? ctx.user(u) : null);

  await db.delete(s.announcementReceipts);
  await db.delete(s.announcements);
  await db.delete(s.posts); // cascades to comments, reactions, saved posts
  await db.delete(s.homeCards);
  await db.delete(s.greetings);

  // The deadline lives only in ends_at; the body never types a date, so the two cannot disagree.
  const securityDeadline = inDays(7);
  const [securityPolicy] = await db.insert(s.announcements).values([
    {
      title: "Please read the updated information security policy",
      body: `We have updated the [security policy](/knowledge/it/security-policy) with new rules for AI tools, personal devices and sharing customer data. It takes about ten minutes to read. Everyone needs to confirm they have read it before the deadline.`,
      severity: "important",
      mustAcknowledge: true,
      startsAt: hoursAgo(days(2)),
      endsAt: securityDeadline,
      authorId: uid("anya.kowalski"),
    },
    {
      title: "Berlin office opens on Monday 2 November",
      body: "Building access cards are ready to collect from Leila. If you have not requested one yet, ask through [Help](/help).",
      severity: "info",
      startsAt: hoursAgo(days(1)),
      endsAt: inDays(21),
      authorId: uid("emily.ross"),
    },
    {
      title: "GitHub maintenance on Saturday from 08:00 to 10:00 UTC",
      body: "We are upgrading the runners and rotating deploy keys. Pushes will queue and CI will pause during the window. Nothing is needed from you.",
      severity: "info",
      audienceGroupIds: [ctx.group("engineering")],
      startsAt: hoursAgo(10),
      endsAt: inDays(3),
      authorId: uid("leila.haddad"),
    },
  ]).returning({ id: s.announcements.id });

  // Some people have already confirmed the security policy, so the read report has data.
  const confirmed = [
    "anya.kowalski", "alex.morgan", "elena.vasquez", "david.kim", "amara.nwosu", "grace.okoye", "nikolai.petrov",
    "kenji.watanabe", "omar.farouk", "priya.raman", "ben.carter", "jordan.blake", "leila.haddad", "nora.sullivan",
  ].filter(known);
  if (securityPolicy && confirmed.length) {
    await db.insert(s.announcementReceipts).values(
      confirmed.map((u, i) => ({ announcementId: securityPolicy.id, userId: ctx.user(u), acknowledgedAt: hoursAgo(40 - i * 2) })),
    );
  }

  for (const p of POSTS) {
    const [row] = await db
      .insert(s.posts)
      .values({
        title: p.title,
        summary: p.summary,
        body: p.body,
        category: p.category,
        authorId: uid(p.author),
        audienceGroupIds: (p.audience ?? []).map((g) => ctx.group(g)),
        pinned: p.pinned ?? false,
        publishedAt: hoursAgo(p.hoursAgo),
        createdAt: hoursAgo(p.hoursAgo + 2),
      })
      .returning({ id: s.posts.id });
    const postId = row!.id;
    const likes = p.likes.filter(known).map((u, i) => ({
      postId,
      userId: ctx.user(u),
      kind: "like",
      createdAt: hoursAgo(Math.max(0, p.hoursAgo - 1 - i)),
    }));
    if (likes.length) await db.insert(s.reactions).values(likes);
    const saves = (p.saves ?? []).filter(known).map((u) => ({ postId, userId: ctx.user(u) }));
    if (saves.length) await db.insert(s.savedPosts).values(saves);
    const comments = p.comments
      .filter(([u]) => known(u))
      .map(([u, body, h]) => ({ postId, authorId: ctx.user(u), body, createdAt: hoursAgo(h) }));
    if (comments.length) await db.insert(s.comments).values(comments);
  }

  await db.insert(s.homeCards).values([
    {
      type: "kpi",
      title: "Next payday",
      config: { compute: "next-payday", hint: "Paid on the last working day of each month" },
      sortOrder: 0,
    },
    {
      type: "links",
      title: "Useful links",
      config: {
        links: [
          { label: "Holiday policy", href: "/knowledge/people/holiday-policy" },
          { label: "Expenses policy", href: "/knowledge/finance/expenses-policy" },
          { label: "Get IT help", href: "/help" },
          { label: "Find a colleague", href: "/people" },
          { label: "Code of conduct", href: "/knowledge/people/code-of-conduct" },
        ],
      },
      sortOrder: 1,
    },
    {
      type: "kpi",
      title: "Offices today",
      config: { value: "4 of 4 open", hint: "London, Berlin, Austin and Bengaluru" },
      sortOrder: 2,
    },
    {
      type: "links",
      title: "Engineering",
      config: {
        links: [
          { label: "On-call handbook", href: "/knowledge/engineering/on-call" },
          { label: "Dev environment setup", href: "/knowledge/engineering/dev-environment" },
          { label: "Service dashboards", href: "/apps/launch/grafana", external: true },
        ],
      },
      audienceGroupIds: [ctx.group("engineering")],
      sortOrder: 3,
    },
  ]);

  // Greetings already sent to recent joiners, so the rail shows both states.
  const greetings: [string, string, string, number][] = [
    ["grace.okoye", "ravi.shankar", "Welcome, Ravi! Shout if you want a tour of the platform repos.", days(10)],
    ["maya.chen", "ravi.shankar", "Hi Ravi, welcome to Northwind. Coffee next time you are in Berlin?", days(9)],
    ["emily.ross", "carlos.mendes", "So glad you are here, Carlos.", days(6)],
  ];
  const rows = greetings
    .filter(([f, t]) => known(f) && known(t))
    .map(([f, t, message, h]) => ({ fromUserId: ctx.user(f), toUserId: ctx.user(t), message, createdAt: hoursAgo(h) }));
  if (rows.length) await db.insert(s.greetings).values(rows);
}
