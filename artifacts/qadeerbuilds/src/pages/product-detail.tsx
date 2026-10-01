import { useGetPublicProduct } from '@workspace/api-client-react';
import { AlertCircle, ArrowLeft, Image as ImageIcon, MapPin, Store } from 'lucide-react';
import { Link } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingCards, PageIntro, SectionLabel, Shell } from '@/components/qadeerbuilds-shell';
import { SupplierContactActions } from '@/components/supplier-contact-actions';

const pkrFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

function formatPkr(value: number) {
  return pkrFormatter.format(value);
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  return candidate.status === 404 || candidate.response?.status === 404;
}

/**
 * Phase 6B public product page.
 *
 * Shows one real product with its category and public supplier, and links
 * through to that supplier's store. There is deliberately no contact action,
 * quote form, rating, verification or buy button here: those are Phase 6C or
 * later, and a supplier's phone and WhatsApp are not even part of this
 * response.
 */
export function ProductDetail({ id }: { id: string }) {
  const query = useGetPublicProduct(id);
  const product = query.data?.product;
  const category = query.data?.category;
  const supplier = query.data?.supplier;

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
            <div className="mt-6" data-testid="product-not-found">
              <PageIntro
                eyebrow="Marketplace"
                title="We could not find that product."
                body="The listing may have been removed or unpublished. Browse the marketplace for current materials."
              />
            </div>
          ) : (
            <div
              className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-6"
              data-testid="status-product-detail-error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <p className="font-semibold">This product could not be loaded.</p>
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
        ) : product ? (
          <>
            <div className="mt-8 grid gap-8 md:grid-cols-[1.05fr_.95fr] md:items-start">
              <div
                className="overflow-hidden rounded-2xl border border-border bg-card"
                data-testid="product-image-area"
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-64 w-full object-cover sm:h-80"
                  />
                ) : (
                  <div className="grid h-64 w-full place-items-center bg-muted/40 text-muted-foreground sm:h-80">
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="size-8" />
                      <p className="font-mono-ui text-[9px] uppercase tracking-[.12em]">
                        No image supplied
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                {category ? (
                  <Link
                    href={`/marketplace?category=${category.id}`}
                    data-testid="link-product-category"
                    className="inline-block rounded-full bg-muted px-3 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"
                  >
                    {category.name}
                  </Link>
                ) : null}

                <h1
                  className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-0.05em] sm:text-5xl"
                  data-testid="text-product-name"
                >
                  {product.name}
                </h1>

                <p
                  className="mt-4 font-display text-3xl font-bold tracking-[-0.04em]"
                  data-testid="text-product-detail-price"
                >
                  {typeof product.price === 'number' && Number.isFinite(product.price)
                    ? formatPkr(product.price)
                    : 'Price on request'}
                </p>
                {product.unit ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sold per {product.unit}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {product.city}
                  </span>
                  {product.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {product.location}
                    </span>
                  ) : null}
                </div>

                {product.description ? (
                  <p className="mt-6 whitespace-pre-wrap text-base leading-7 text-muted-foreground">
                    {product.description}
                  </p>
                ) : (
                  <p className="mt-6 text-sm text-muted-foreground">
                    This supplier has not added a description for this material.
                  </p>
                )}
              </div>
            </div>

            {supplier ? (
              <div
                className="mt-10 rounded-2xl border border-border bg-card p-6"
                data-testid="product-supplier-section"
              >
                <SectionLabel>Supplier</SectionLabel>
                <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                  <Avatar className="size-16 shrink-0 rounded-2xl">
                    {supplier.logoUrl ? (
                      <AvatarImage
                        src={supplier.logoUrl}
                        alt={supplier.name}
                        className="rounded-2xl"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-2xl font-display text-xl font-bold text-secondary">
                      {supplier.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="font-display text-2xl font-bold tracking-[-0.04em]">
                      {supplier.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {supplier.city}
                      {supplier.location ? ` · ${supplier.location}` : ''}
                    </p>
                    {supplier.description ? (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {supplier.description}
                      </p>
                    ) : null}
                    <Link
                      href={`/marketplace/suppliers/${supplier.id}`}
                      data-testid="link-view-supplier"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary"
                    >
                      <Store className="size-4" />
                      View supplier store
                    </Link>
                  </div>
                </div>

                {/* Phase 6C: the same three contact actions as the store page,
                    attached to this product so the enquiry is about this material. */}
                <div className="mt-5 border-t border-border pt-5">
                  <SupplierContactActions supplier={supplier} productId={product.id} />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </Shell>
  );
}