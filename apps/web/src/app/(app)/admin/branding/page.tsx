import { getOrgSettings } from "@lobby/core";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/ui/page-header";
import { BrandingForm } from "@/components/admin/branding-form";
import { requireAdmin } from "@/server/auth";

export const metadata = { title: "Branding" };

export default async function BrandingPage() {
  await requireAdmin();
  const org = await getOrgSettings();
  return (
    <Page width="wide">
      <PageHeader title="Branding" description="Your company's name, logo and colour, shown to everyone on every page." />
      <BrandingForm
        initial={{
          companyName: org.companyName,
          productName: org.productName,
          logoUrl: org.logoUrl,
          accentColor: org.accentColor,
          timezone: org.timezone,
          workingDays: org.workingDays,
          emailDomain: org.emailDomain,
        }}
      />
    </Page>
  );
}
