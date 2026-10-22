import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getOrgSettings } from "@lobby/core";
import { FrontDoor } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatDateline } from "@/components/ui/dateline";

export const metadata = { title: "Signed out" };

export default async function SignedOutPage() {
  const org = await getOrgSettings();
  return (
    <FrontDoor
      name={org.companyName}
      logoUrl={org.logoUrl}
      dateline={formatDateline(new Date(), org.timezone)}
      productName={org.productName}
      lit={false}
      caption="Everything you opened from here is closed again. Sign in once and it all opens back up."
    >
      <h1 className="text-h1 font-medium text-fg text-balance lg:text-display">You are signed out</h1>
      <p className="mt-3 text-body-lg text-muted text-pretty">
        You have been signed out of {org.productName} and of your {org.companyName} sign-in. Apps you opened from here will ask you to sign in
        again.
      </p>
      <Link href="/sign-in" className={buttonVariants({ size: "lg", className: "mt-8 w-full" })}>
        Sign in again
        <ArrowRight aria-hidden />
      </Link>
    </FrontDoor>
  );
}
