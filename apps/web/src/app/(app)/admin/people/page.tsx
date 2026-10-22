import Link from "next/link";
import { Upload } from "lucide-react";
import { listPeopleForAdmin } from "@lobby/core/people";
import { accountCounts } from "@lobby/core/counts";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { AdminPeopleTable } from "@/components/people/admin-people-table";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "People admin" };

export default async function AdminPeoplePage() {
  const ctx = await requireAdmin();
  const [{ rows, counts }, acc] = await Promise.all([listPeopleForAdmin(ctx, { status: "all" }), accountCounts(ctx)]);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  // The canonical account line: "41 accounts: 40 people and 1 admin account", plus deactivated when there are any.
  const summary = acc
    ? `${plural(acc.accounts, "account", "accounts")}: ${plural(acc.people, "person", "people")} and ${plural(acc.admin, "admin account", "admin accounts")}${acc.deactivated ? `, ${acc.deactivated} deactivated` : ""}.`
    : "";
  return (
    <Page
      width="wide"
      title="People"
      today={`${summary} Everyone here came from sign-in, SCIM or a CSV import.`}
      inlineActions
      actions={
        <Button asChild size="icon" aria-label="Import CSV" className="sm:w-auto sm:px-3.5 md:w-auto">
          <Link href="/admin/people/import">
            <Upload aria-hidden />
            <span className="hidden sm:inline">Import CSV</span>
          </Link>
        </Button>
      }
    >
      <AdminPeopleTable
        viewerId={ctx.user.id}
        counts={counts}
        rows={rows.map((r) => ({ ...r, lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null }))}
      />
    </Page>
  );
}
