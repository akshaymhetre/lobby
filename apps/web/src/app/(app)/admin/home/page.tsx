import { asc, db, s } from "@lobby/db";
import { listAnnouncementsAdmin, listHomeCardsAdmin } from "@lobby/core/home";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementsAdmin } from "@/components/home/admin/announcements-admin";
import { CardsAdmin } from "@/components/home/admin/cards-admin";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Home page · Admin" };

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireAdmin();
  const [sp, announcements, cards, groups] = await Promise.all([
    searchParams,
    listAnnouncementsAdmin(ctx),
    listHomeCardsAdmin(ctx),
    db.select({ id: s.groups.id, name: s.groups.displayName }).from(s.groups).orderBy(asc(s.groups.displayName)),
  ]);
  return (
    <Page width="wide">
      <PageHeader
        title="Home page"
        description="What everyone sees when they open Lobby. News posts are written from the home page by content editors."
      />
      <Tabs defaultValue={sp.tab === "cards" ? "cards" : "announcements"}>
        <TabsList>
          <TabsTrigger value="announcements">
            Announcements <TabsCount>{announcements.length}</TabsCount>
          </TabsTrigger>
          <TabsTrigger value="cards">
            Home cards <TabsCount>{cards.length}</TabsCount>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="announcements" className="pt-5">
          <AnnouncementsAdmin
            groups={groups}
            rows={announcements.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              severity: a.severity,
              mustAcknowledge: a.mustAcknowledge,
              audienceGroupIds: a.audienceGroupIds,
              startsAt: a.startsAt.toISOString(),
              endsAt: a.endsAt ? a.endsAt.toISOString() : null,
              authorName: a.authorName,
              audienceSize: a.audienceSize,
              acknowledged: a.acknowledged,
            }))}
          />
        </TabsContent>
        <TabsContent value="cards" className="pt-5">
          <CardsAdmin
            groups={groups}
            cards={cards.map((c) => ({ id: c.id, type: c.type, title: c.title, config: c.config, audienceGroupIds: c.audienceGroupIds }))}
          />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
