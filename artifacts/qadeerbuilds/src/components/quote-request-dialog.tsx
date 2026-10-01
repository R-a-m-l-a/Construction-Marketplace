import { useCreateProfessionalQuoteRequest } from '@workspace/api-client-react';
import { AlertCircle, Check, Image as ImageIcon, LoaderCircle, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { isAllowedImageUrl, PROFESSIONAL_IMAGE_URL_MAX_LENGTH } from '@/lib/image-url';

const MAX_IMAGES = 5;

const fieldClass =
  'mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary';
const labelClass = 'text-sm font-bold';

type QuoteForm = {
  name: string;
  email: string;
  size: string;
  details: string;
  imageUrls: string[];
};

const emptyForm: QuoteForm = { name: '', email: '', size: '', details: '', imageUrls: [] };

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return fallback;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Phase 5D "Get a Quote".
 *
 * Exactly the fields the verified Tameer flow collects: name, email, size,
 * details and up to five image links. No budget, timeline, phone, address or
 * preferred date, and nothing here generates or promises an amount: the
 * professional reads the request and responds themselves.
 *
 * The dialog is the visitor's only submission path; the API derives ownership
 * from the professional id in the URL and never trusts anything else.
 */
export function QuoteRequestDialog({
  professionalId,
  professionalName,
}: {
  professionalId: string;
  professionalName: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<QuoteForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const mutation = useCreateProfessionalQuoteRequest();

  const reset = () => {
    setForm(emptyForm);
    setError(null);
    setSent(false);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const setImage = (index: number, value: string) => {
    setError(null);
    setForm((current) => {
      const imageUrls = [...current.imageUrls];
      imageUrls[index] = value;
      return { ...current, imageUrls };
    });
  };

  const addImage = () => {
    if (form.imageUrls.length >= MAX_IMAGES) return;
    setForm((current) => ({ ...current, imageUrls: [...current.imageUrls, ''] }));
  };

  const removeImage = (index: number) => {
    setForm((current) => ({
      ...current,
      imageUrls: current.imageUrls.filter((_, position) => position !== index),
    }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutation.isPending || sent) return;

    const name = form.name.trim();
    const email = form.email.trim();
    const size = form.size.trim();
    const details = form.details.trim();

    if (name.length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!isEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (size.length < 2) {
      setError('Please tell us the size, for example 5 marla or 2,000 sq ft.');
      return;
    }
    if (details.length < 2) {
      setError('Please describe what you need.');
      return;
    }

    const imageUrls = form.imageUrls.map((value) => value.trim()).filter(Boolean);
    if (imageUrls.length > MAX_IMAGES) {
      setError(`You can add up to ${MAX_IMAGES} image links.`);
      return;
    }
    const badImage = imageUrls.find((value) => !isAllowedImageUrl(value));
    if (badImage) {
      setError('Each image must be a full http or https link.');
      return;
    }

    setError(null);
    mutation.mutate(
      {
        id: professionalId,
        data: {
          name,
          email,
          size,
          details,
          ...(imageUrls.length ? { imageUrls } : {}),
        },
      },
      {
        onSuccess: () => setSent(true),
        onError: (submitError) =>
          setError(errorMessage(submitError, 'We could not send your request. Please try again.')),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="button-get-a-quote"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          <Send className="size-4" />
          Get a Quote
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="dialog-quote-request">
        <DialogHeader>
          <DialogTitle>Get a Quote</DialogTitle>
          <DialogDescription>
            Send {professionalName} the details of what you need. They will get back to you on the
            email you share.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div
            className="mt-5 rounded-xl border border-border bg-muted/40 p-5 text-center"
            data-testid="status-quote-sent"
          >
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-6" />
            </div>
            <p className="mt-4 font-semibold">Your quote request was sent.</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {professionalName} can now read your request and reply to you by email. There is no
              price shown here: a quote comes from them, not from this page.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4" data-testid="form-quote-request" noValidate>
            <div>
              <label htmlFor="quote-name" className={labelClass}>
                Your name
              </label>
              <input
                id="quote-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(event) => {
                  setError(null);
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                placeholder="e.g. Ahmed Khan"
                data-testid="input-quote-name"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="quote-email" className={labelClass}>
                Email
              </label>
              <input
                id="quote-email"
                type="email"
                required
                maxLength={254}
                value={form.email}
                onChange={(event) => {
                  setError(null);
                  setForm((current) => ({ ...current, email: event.target.value }));
                }}
                placeholder="you@example.com"
                data-testid="input-quote-email"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="quote-size" className={labelClass}>
                Size
              </label>
              <input
                id="quote-size"
                required
                maxLength={120}
                value={form.size}
                onChange={(event) => {
                  setError(null);
                  setForm((current) => ({ ...current, size: event.target.value }));
                }}
                placeholder="e.g. 5 marla or 2,000 sq ft"
                data-testid="input-quote-size"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="quote-details" className={labelClass}>
                Details
              </label>
              <textarea
                id="quote-details"
                required
                maxLength={2000}
                value={form.details}
                onChange={(event) => {
                  setError(null);
                  setForm((current) => ({ ...current, details: event.target.value }));
                }}
                placeholder="What you want built or repaired, the stage it is at, and anything else that helps."
                data-testid="textarea-quote-details"
                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className={labelClass}>Images</span>
                <button
                  type="button"
                  onClick={addImage}
                  disabled={form.imageUrls.length >= MAX_IMAGES}
                  data-testid="button-add-quote-image"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-accent disabled:opacity-50"
                >
                  <ImageIcon className="size-3.5" />
                  Add image link
                </button>
              </div>
              {form.imageUrls.length ? (
                <div className="mt-2 space-y-2">
                  {form.imageUrls.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        maxLength={PROFESSIONAL_IMAGE_URL_MAX_LENGTH}
                        value={value}
                        onChange={(event) => setImage(index, event.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        aria-label={`Image link ${index + 1}`}
                        data-testid={`input-quote-image-${index}`}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-secondary"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label={`Remove image link ${index + 1}`}
                        data-testid={`button-remove-quote-image-${index}`}
                        className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. Paste up to {MAX_IMAGES} public image links.
                </p>
              )}
            </div>

            {error ? (
              <p
                className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent"
                aria-live="polite"
                data-testid="status-quote-error"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <button
                type="submit"
                disabled={mutation.isPending}
                aria-busy={mutation.isPending}
                data-testid="button-submit-quote"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
              >
                {mutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {mutation.isPending ? 'Sending...' : 'Send quote request'}
              </button>
            </DialogFooter>

            <p className="text-center font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
              Image links only. There is no file upload.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
