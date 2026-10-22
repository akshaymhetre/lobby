import Link from "next/link";
import { Search } from "lucide-react";
import { getOrgSettings } from "@lobby/core";
import { FrontDoor } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { formatDateline } from "@/components/ui/dateline";

export const metadata = { title: "Page not found" };

/**
 * The 404 outside the app shell: the same front-door slab as sign-in, so the page is still the
 * company's, and the primary action is the thing the copy suggests: search.
 */
export default async function NotFound() {
  const org = await getOrgSettings();
  return (
    <FrontDoor name={org.companyName} logoUrl={org.logoUrl} dateline={formatDateline(new Date(), org.timezone)} productName={org.productName}
      caption="Everything here lives in one of these six places. Search finds it whichever one it is in."
    >
      <p className="text-caption font-medium tabular text-subtle">404</p>
      <h1 className="mt-1.5 text-h1 font-medium text-fg text-balance lg:text-display">This page does not exist</h1>
      <p className="mt-3 text-body-lg text-muted text-pretty">It may have moved or been archived. Search for it, or start again from home.</p>
      <form action="/search" method="get" className="mt-7 flex items-center gap-2">
        <label htmlFor="not-found-search" className="sr-only">
          Search {org.companyName}
        </label>
        <Input id="not-found-search" name="q" type="search" placeholder="Search people, pages, apps" leading={<Search aria-hidden />} autoFocus />
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-5 border-t border-border pt-3">
        <Link href="/" className={buttonVariants({ variant: "ghost", className: "-ml-3.5" })}>
          Back to home
        </Link>
      </div>
    </FrontDoor>
  );
}
