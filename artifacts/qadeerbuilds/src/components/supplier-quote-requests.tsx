import {
  getListMySupplierQuoteRequestsQueryKey,
  useListMySupplierQuoteRequests,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Image as ImageIcon, Inbox, Mail, Package, Ruler } from 'lucide-react';
import { Link } from 'wouter';
import { SectionLabel } from '@/components/qadeerbuilds-shell';

function isMissingSupplierError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  return candidate.status === 404 || candidate.response?.status === 404;
}

const dateFormatter = new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium' });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : dateFormatter.format(date);
}

/**
 * Phase 6C supplier-owner view of received material quote requests.
 *
 * Read-only by design: no status, reply composer, assignment, scoring or
 * notification. The supplier reads the request and responds by email, which is
 * the verified behaviour. Mirrors the professional quote view so both entities
 * present received requests the same way.
 */
export function SupplierQuoteRequests() {
  const queryClient = useQueryClient();
  const quotesQuery = useListMySupplierQuoteRequests();
  const quotes = quotesQuery.data ?? [];
  const needsSupplier = isMissingSupplierError(quotesQuery.error);

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: getListMySupplierQuoteRequestsQueryKey(),
    });
  };

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 sm:p-8"
      data-testid="supplier-quotes"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionLabel>Quote Requests</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.05em]">
            What people asked about.
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Enquiries sent to your supplier store. Reply to them by email.
          </p>
        </div>
        {!quotesQuery.isLoading ? (
          <p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
            {quotes.length} {quotes.length === 1 ? 'request' : 'requests'}
          </p>
        ) : null}
      </div>

      {quotesQuery.isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="h-28 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="h-28 w-full animate-pulse rounded-xl bg-muted/60" />
        </div>
      ) : quotesQuery.isError ? (
        needsSupplier ? (
          <p
            className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="supplier-quotes-needs-supplier"
          >
            No supplier profile is linked to your account, so there are no quote requests to show.
          </p>
        ) : (
          <div
            className="mt-6 rounded-xl border border-accent/30 bg-accent/10 p-4"
            data-testid="status-supplier-quotes-error"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <p className="font-semibold">Your quote requests could not be loaded.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The marketplace service may be temporarily unavailable.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void quotesQuery.refetch()}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )
      ) : quotes.length ? (
        <ul className="mt-6 space-y-4" data-testid="supplier-quotes-list">
          {quotes.map((quote) => (
            <li
              key={quote.id}
              className="rounded-xl border border-border bg-background p-5"
              data-testid={`supplier-quote-item-${quote.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold tracking-[-0.03em]">{quote.name}</p>
                  <a
                    href={`mailto:${quote.email}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
                    data-testid={`link-supplier-quote-email-${quote.id}`}
                  >
                    <Mail className="size-3.5" />
                    {quote.email}
                  </a>
                </div>
                <p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                  {formatDate(quote.createdAt)}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <p className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-bold">
                  <Ruler className="size-3.5" />
                  {quote.size}
                </p>
                {quote.productId ? (
                  <Link
                    href={`/marketplace/products/${quote.productId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-bold"
                    data-testid={`link-supplier-quote-product-${quote.id}`}
                  >
                    <Package className="size-3.5" />
                    About a listed material
                  </Link>
                ) : (
                  <p className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                    <Package className="size-3.5" />
                    General enquiry
                  </p>
                )}
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {quote.details}
              </p>

              {quote.imageUrls.length ? (
                <div className="mt-4" data-testid={`supplier-quote-images-${quote.id}`}>
                  <p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                    Images
                  </p>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                    {quote.imageUrls.map((imageUrl) => (
                      <li key={imageUrl}>
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border border-border"
                        >
                          <img
                            src={imageUrl}
                            alt={`Reference from ${quote.name}`}
                            loading="lazy"
                            className="h-28 w-full object-cover"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p
          className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center"
          data-testid="supplier-quotes-empty"
        >
          <Inbox className="size-6 text-muted-foreground" />
          <p className="font-semibold">No quote requests yet.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            When someone sends you an enquiry from your store, it will appear here.
          </p>
        </p>
      )}
    </section>
  );
}