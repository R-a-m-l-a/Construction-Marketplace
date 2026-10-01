import type { ProductPreview } from '@workspace/api-client-react';
import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'wouter';

const pkrFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

function formatPkr(value: number) {
  return pkrFormatter.format(value);
}

/**
 * Marketplace product card.
 *
 * Renders only database-backed fields. `price` is the source of truth: a
 * numeric amount is formatted as PKR, and null renders "Price on request"
 * rather than inventing a figure. There is no "Demo content" tag.
 *
 * Since Phase 6B the whole card is a single link to the product's public detail
 * page. It is reused unchanged on the homepage preview, the marketplace listing
 * and the supplier store page. The card has no nested interactive controls of
 * its own, so there is nothing for a click to accidentally trigger.
 */
export function ProductCard({ product }: { product: ProductPreview }) {
  const hasPrice = typeof product.price === 'number' && Number.isFinite(product.price);

  return (
    <Link
      href={`/marketplace/products/${product.id}`}
      data-testid={`link-product-${product.id}`}
      aria-label={`View ${product.name}`}
      className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 transition-transform hover:-translate-y-1"
    >
      <article
        data-testid={`card-product-${product.id}`}
        className="flex min-h-[188px] flex-col justify-between"
      >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="mb-4 h-32 w-full rounded-xl object-cover"
        />
      ) : null}
      <div>
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-muted px-2.5 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">
            {product.category}
          </span>
        </div>
        <h3 className="mt-6 font-display text-2xl font-bold leading-tight tracking-[-.04em]">
          {product.name}
        </h3>
        {product.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {product.description}
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex items-end justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-bold" data-testid={`text-product-price-${product.id}`}>
            {hasPrice ? formatPkr(product.price as number) : 'Price on request'}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> {product.city}
            {product.location ? ` · ${product.location}` : ''}
            {' · '}
            {product.supplier}
          </p>
        </div>
        <ArrowRight className="size-4 rotate-[-45deg] text-accent transition-transform group-hover:translate-x-1" />
      </div>
      </article>
    </Link>
  );
}
