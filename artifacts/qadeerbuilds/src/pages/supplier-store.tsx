import { useGetPublicSupplier } from '@workspace/api-client-react';
import { AlertCircle, ArrowLeft, Inbox, MapPin, Store } from 'lucide-react';
import { Link } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProductCard } from '@/components/product-card';
import { SupplierContactActions } from '@/components/supplier-contact-actions';
import { LoadingCards, PageIntro, SectionLabel, Shell } from '@/components/qadeerbuilds-shell';

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  return candidate.status === 404 || candidate.response?.status === 404;
}

/**
 * Phase 6B public supplier store page.
 *
 * Shows a supplier's public information and the materials they have actually
 * published, each linking back to that product's detail page to complete the
 * marketplace -> product -> supplier -> product loop.
 *
 * No ratings, verification, years of experience, contact buttons or quote form:
 * a supplier's phone and WhatsApp are not part of this response at all, and
 * contact actions are Phase 6C.
 */
export function SupplierStore({ id }: { id: string }) {
  const query = useGetPublicSupplier(id);
  const supplier = query.data?.supplier;
  const products = query.data?.products ?? [];

  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <Link
          href="/marketplace"
          data-testid="link-back-marketplace"
          className="inline-flex items-center gap-2 text-sm font-bold text-accent"
        >
          <ArrowLeft className="size-4" />
          Back to marketplace
        </Link>

        {query.isLoading ? (
          <div className="mt-6">
            <LoadingCards count={3} />
          </div>
        ) : query.isError ? (
          isNotFound(query.error) ? (
            <div className="mt-6" data-testid="supplier-not-found">
              <PageIntro
                eyebrow="Marketplace"
                title="We could not find that supplier."
                body="The store may have been removed. Browse the marketplace for current material suppliers."
              />
            </div>
          ) : (
            <div
              className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-6"
              data-testid="status-supplier-detail-error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <p className="font-semibold">This store could not be loaded.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The marketplace service may be temporarily unavailable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Try again
              </button>
            </div>
          )
        ) : supplier ? (
          <>
            <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <Avatar className="size-20 shrink-0 rounded-2xl">
                {supplier.logoUrl ? (
                  <AvatarImage
                    src={supplier.logoUrl}
                    alt={supplier.name}
                    className="rounded-2xl"
                  />
                ) : null}
                <AvatarFallback className="rounded-2xl font-display text-2xl font-bold text-secondary">
                  {supplier.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SectionLabel>Supplier</SectionLabel>
                <h1
                  className="mt-2 font-display text-4xl font-bold tracking-[-0.05em] sm:text-5xl"
                  data-testid="text-supplier-name"
                >
                  {supplier.name}
                </h1>
                <p className="mt-2 flex items-center gap-1 text-sm font-medium text-muted-foreground">
                  <MapPin className="size-4" />
                  {supplier.city}
                  {supplier.location ? ` · ${supplier.location}` : ''}
                </p>
                {supplier.description ? (
                  <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                    {supplier.description}
                  </p>
                ) : (
                  <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                    This supplier has not added a store description.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <SupplierContactActions supplier={supplier} />
            </div>

            <div className="mt-12">
              <div className="flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 font-display text-3xl font-bold tracking-[-0.05em]">
                  <Store className="size-6 text-accent" />
                  Published materials
                </h2>
                {!query.isLoading ? (
                  <p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                    {products.length} {products.length === 1 ? 'listing' : 'listings'}
                  </p>
                ) : null}
              </div>

              {query.isLoading ? (
                <div className="mt-6">
                  <LoadingCards count={3} />
                </div>
              ) : products.length ? (
                <div
                  className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  data-testid="supplier-products-list"
                >
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <p
                  className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center"
                  data-testid="supplier-products-empty"
                >
                  <Inbox className="size-6 text-muted-foreground" />
                  <p className="font-semibold">No materials published yet.</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    This supplier has not listed anything in the marketplace so far.
                  </p>
                </p>
              )}
            </div>
          </>
        ) : null}
      </section>
    </Shell>
  );
}