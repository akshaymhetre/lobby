import { db, s } from "@lobby/db";
import { env } from "./env";
import { mailHtml, queueMail } from "./mail";

/** Creates an in-app notification and, when `email` is true, queues an immediate email too. */
export async function notify(
  userId: string,
  n: { kind: string; title: string; body?: string; href?: string; email?: boolean },
) {
  const [row] = await db
    .insert(s.notifications)
    .values({ userId, kind: n.kind, title: n.title, body: n.body, href: n.href })
    .returning();
  if (n.email) {
    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
    if (user) {
      const url = n.href ? `${env.url}${n.href}` : env.url;
      await queueMail({
        to: user.email,
        subject: n.title,
        text: `${n.body ?? ""}\n\n${url}`,
        html: mailHtml({ heading: n.title, body: n.body ?? "", actionLabel: "Open in Lobby", actionUrl: url }),
      });
    }
  }
  return row!;
}
