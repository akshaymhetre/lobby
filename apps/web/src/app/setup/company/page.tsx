import { getOrgSettings } from "@lobby/core";
import { BrandingForm } from "@/components/admin/branding-form";
import { StepHeader } from "@/components/setup/step-header";
import { SkipButton } from "@/components/setup/step-nav";
import { guardSetup } from "../_guard";

export const metadata = { title: "Company" };

export default async function CompanyStep() {
  await guardSetup("company");
  const org = await getOrgSettings();
  return (
    <StepHeader step="company" aside="slot">
      <BrandingForm
        setupStep="company"
        footer={<SkipButton />}
        initial={{
          companyName: org.companyName === "Your company" ? "" : org.companyName,
          productName: org.productName,
          logoUrl: org.logoUrl,
          accentColor: org.accentColor,
          timezone: org.timezone,
          workingDays: org.workingDays,
          emailDomain: org.emailDomain,
        }}
      />
    </StepHeader>
  );
}
