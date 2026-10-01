import { MessageCircle, Phone } from 'lucide-react';
import { SupplierQuoteRequestDialog } from '@/components/supplier-quote-request-dialog';
import { callLink, whatsappLink } from '@/lib/contact-links';

/**
 * Phase 6C supplier contact row: Get a Quote, WhatsApp and Call.
 *
 * Shared by the supplier store and the product detail page, because a product
 * belongs to exactly one supplier and both surfaces must offer the same three
 * actions for the same real supplier.
 *
 * WhatsApp and Call are rendered **only** when the supplier has actually saved
 * that number, so an incomplete supplier shows fewer actions rather than a
 * broken one. Both links are built by the shared `contact-links` utility used
 * for professional profiles, so the Pakistan number normalisation is identical
 * and no second policy exists. No number is ever invented.
 */
export function SupplierContactActions({
  supplier,
  productId,
}: {
  supplier: {
    id: string;
    name: string;
    phone?: string | null;
    whatsapp?: string | null;
  };
  productId?: string;
}) {
  const whatsapp = supplier.whatsapp?.trim() ?? '';
  const phone = supplier.phone?.trim() ?? '';

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="supplier-contact-actions"
    >
      <SupplierQuoteRequestDialog
        supplierId={supplier.id}
        supplierName={supplier.name}
        {...(productId ? { productId } : {})}
        triggerTestId={productId ? 'button-product-get-a-quote' : 'button-supplier-get-a-quote'}
      />

      {whatsapp ? (
        <a
          href={whatsappLink(whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="button-supplier-whatsapp"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-bold"
        >
          <MessageCircle className="size-4" />
          WhatsApp
        </a>
      ) : null}

      {phone ? (
        <a
          href={callLink(phone)}
          data-testid="button-supplier-call"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-bold"
        >
          <Phone className="size-4" />
          Call
        </a>
      ) : null}
    </div>
  );
}