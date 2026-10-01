/**
 * Phase 5D contact links for the public professional profile.
 *
 * Both actions use the professional's own stored number and nothing else: no
 * placeholder number, no demo data, and no in-app messaging or calling. When
 * the professional has not saved a number the action is simply not rendered,
 * so a broken button never appears.
 */

/**
 * WhatsApp's click-to-chat link needs a bare international number with no
 * symbols. A number stored in local trunk form (for example 03001234567) is
 * converted to its international form using Pakistan's country code, because
 * QadeerBuilds serves Pakistan. Numbers already stored in international form
 * are passed through untouched. The stored value itself is never modified.
 */
export function whatsappLink(storedNumber: string): string {
  const digits = storedNumber.replace(/\D/g, '');
  if (!digits) return '';
  const international = digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

/** tel: link for the Call now action. */
export function callLink(storedNumber: string): string {
  const trimmed = storedNumber.trim();
  return trimmed ? `tel:${trimmed.replace(/[^\d+]/g, "")}` : '';
}
