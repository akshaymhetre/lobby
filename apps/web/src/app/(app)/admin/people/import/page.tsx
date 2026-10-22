import { IMPORT_FIELDS } from "@lobby/core/people/csv";
import { Page } from "@/components/page";
import { Breadcrumb, PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "@/components/people/import-wizard";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Import people" };

export default async function ImportPeoplePage() {
  await requireAdmin();
  return (
    <Page width="wide">
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: "People", href: "/admin/people" }, { label: "Import" }]} />}
        title="Import people from a CSV"
        description="Add or update people in bulk. We match on work email, so running the same file twice updates people instead of duplicating them."
      />
      <ImportWizard fields={IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label, required: "required" in f && f.required }))} />
    </Page>
  );
}
