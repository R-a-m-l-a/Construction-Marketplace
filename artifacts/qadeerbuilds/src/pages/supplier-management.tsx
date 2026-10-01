import { Link } from 'wouter';
import { ArrowLeft, Store } from 'lucide-react';
import { SupplierQuoteRequests } from '@/components/supplier-quote-requests';
import { PageIntro, Shell } from '@/components/qadeerbuilds-shell';

/**
 * Phase 6C minimal supplier management area.
 *
 * The professional equivalent is `/professionals/me`, which shows the
 * professional's own profile and their received quote requests. This is the
 * matching location for a supplier: a read-only list of the enquiries sent to
 * their store. Deliberately minimal — no onboarding, registration, dashboard,
 * analytics or settings, which are out of scope for this phase.
 */
export function SupplierManagement() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1000px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <Link
          href="/marketplace"
          data-testid="link-back-marketplace"
          className="inline-flex items-center gap-2 text-sm font-bold text-accent"
        >
          <ArrowLeft className="size-4" />
          Back to marketplace
        </Link>

        <div className="mt-8 flex items-center gap-4">
          <Store className="size-7 shrink-0 text-accent" />
          <PageIntro
            eyebrow="Marketplace / your supplier store"
            title="Quote requests"
            body="Enquiries visitors have sent to your supplier store."
          />
        </div>

        <div className="mt-8">
          <SupplierQuoteRequests />
        </div>
      </section>
    </Shell>
  );
}