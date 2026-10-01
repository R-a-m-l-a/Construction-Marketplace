import { useQueryClient } from '@tanstack/react-query';
import {
  getListMyProfessionalProjectsQueryKey,
  useCreateMyProfessionalProject,
  useDeleteMyProfessionalProject,
  useListMyProfessionalProjects,
  useUpdateMyProfessionalProject,
} from '@workspace/api-client-react';
import type { ProfessionalProject } from '@workspace/api-client-react';
import {
  AlertCircle,
  Check,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { isAllowedImageUrl, PROFESSIONAL_IMAGE_URL_MAX_LENGTH } from '@/lib/image-url';
import { SectionLabel } from '@/components/qadeerbuilds-shell';

type PortfolioForm = {
  title: string;
  description: string;
  location: string;
  imageUrl: string;
};

type PortfolioMessage = { kind: 'success' | 'error'; text: string };

const emptyPortfolioForm: PortfolioForm = {
  title: '',
  description: '',
  location: '',
  imageUrl: '',
};

const fieldClass =
  'mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-secondary';
const labelClass = 'text-sm font-bold';

function formFromProject(project: ProfessionalProject): PortfolioForm {
  return {
    title: project.title ?? '',
    description: project.description ?? '',
    location: project.location ?? '',
    imageUrl: project.imageUrl ?? '',
  };
}

function projectErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return fallback;
}

function isMissingProfileError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  return candidate.status === 404 || candidate.response?.status === 404;
}

/**
 * Phase 5C portfolio editor. Mounted inside the signed-in professional profile
 * page, so the professional record already exists by the time this renders.
 *
 * Ownership is never sent by the client: the API resolves the professional from
 * the Clerk session, and this form only ever sends project fields.
 */
export function ProfessionalPortfolio() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PortfolioForm>(emptyPortfolioForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<PortfolioMessage | null>(null);

  const projectsQuery = useListMyProfessionalProjects();
  const projects = projectsQuery.data ?? [];
  const needsProfile = isMissingProfileError(projectsQuery.error);

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: getListMyProfessionalProjectsQueryKey(),
    });
  };

  const createMutation = useCreateMyProfessionalProject({
    mutation: {
      onSuccess: async () => {
        setForm(emptyPortfolioForm);
        setMessage({ kind: 'success', text: 'Project added to your portfolio.' });
        await refresh();
      },
      onError: (error) =>
        setMessage({
          kind: 'error',
          text: projectErrorMessage(error, 'We could not add that project.'),
        }),
    },
  });

  const updateMutation = useUpdateMyProfessionalProject({
    mutation: {
      onSuccess: async () => {
        setEditingId(null);
        setForm(emptyPortfolioForm);
        setMessage({ kind: 'success', text: 'Project updated.' });
        await refresh();
      },
      onError: (error) =>
        setMessage({
          kind: 'error',
          text: projectErrorMessage(error, 'We could not update that project.'),
        }),
    },
  });

  const deleteMutation = useDeleteMyProfessionalProject({
    mutation: {
      onSuccess: async () => {
        setMessage({ kind: 'success', text: 'Project removed.' });
        await refresh();
      },
      onError: (error) =>
        setMessage({
          kind: 'error',
          text: projectErrorMessage(error, 'We could not remove that project.'),
        }),
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const isEditing = editingId !== null;

  const update = (field: keyof PortfolioForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setMessage(null);
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const startEditing = (project: ProfessionalProject) => {
    setEditingId(project.id);
    setForm(formFromProject(project));
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setForm(emptyPortfolioForm);
    setMessage(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const title = form.title.trim();
    if (!title) {
      setMessage({ kind: 'error', text: 'A project title is required.' });
      return;
    }
    if (!isAllowedImageUrl(form.imageUrl)) {
      setMessage({ kind: 'error', text: 'Image must be an absolute http or https image URL.' });
      return;
    }

    const data = {
      title,
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      imageUrl: form.imageUrl.trim(),
    };

    if (isEditing && editingId) {
      updateMutation.mutate({ id: editingId, data });
      return;
    }

    createMutation.mutate({ data });
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-8" data-testid="portfolio-professional">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionLabel>Portfolio</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.05em]">Show the work.</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Add projects clients can look at. Paste a public image link for each one.
          </p>
        </div>
        {!isEditing ? (
          <p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        ) : null}
      </div>

      {projectsQuery.isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/60" />
        </div>
      ) : projectsQuery.isError ? (
        needsProfile ? (
          <p className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground" data-testid="portfolio-needs-profile">
            Create your professional profile first, then you can add projects to it.
          </p>
        ) : (
          <div className="mt-6 rounded-xl border border-accent/30 bg-accent/10 p-4" data-testid="status-portfolio-error">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <p className="font-semibold">Your portfolio could not be loaded.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {projectErrorMessage(projectsQuery.error, 'The professional service may be temporarily unavailable.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void projectsQuery.refetch()}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )
      ) : (
        <>
          {projects.length ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="portfolio-list">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="overflow-hidden rounded-xl border border-border bg-background"
                  data-testid={`portfolio-item-${project.id}`}
                >
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={project.title}
                      loading="lazy"
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-36 w-full place-items-center bg-muted/40 text-muted-foreground">
                      <ImageIcon className="size-6" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold">{project.title}</h3>
                    {project.location ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {project.location}
                      </p>
                    ) : null}
                    {project.description ? (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {project.description}
                      </p>
                    ) : null}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(project)}
                        disabled={isPending}
                        data-testid={`button-edit-portfolio-${project.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate({ id: project.id })}
                        disabled={isPending}
                        data-testid={`button-delete-portfolio-${project.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-bold text-accent disabled:opacity-60"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
              data-testid="portfolio-empty"
            >
              No projects yet. Add your first one below.
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="form-portfolio">
            <div className="flex items-center gap-2 border-t border-border pt-6">
              {isEditing ? (
                <Pencil className="size-4 text-accent" />
              ) : (
                <Plus className="size-4 text-accent" />
              )}
              <p className="font-semibold">
                {isEditing ? 'Edit this project' : 'Add a project'}
              </p>
            </div>

            <div>
              <label htmlFor="portfolio-title" className={labelClass}>
                Project title
              </label>
              <input
                required
                id="portfolio-title"
                maxLength={160}
                value={form.title}
                onChange={update('title')}
                placeholder="e.g. 5 marla grey structure"
                data-testid="input-portfolio-title"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="portfolio-description" className={labelClass}>
                What did you do?
              </label>
              <textarea
                id="portfolio-description"
                maxLength={2000}
                value={form.description}
                onChange={update('description')}
                placeholder="Scope, materials, anything a client would want to know."
                data-testid="textarea-portfolio-description"
                className="mt-2 min-h-24 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="portfolio-location" className={labelClass}>
                  Project location
                </label>
                <input
                  id="portfolio-location"
                  maxLength={200}
                  value={form.location}
                  onChange={update('location')}
                  placeholder="e.g. DHA Phase 5, Lahore"
                  data-testid="input-portfolio-location"
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="portfolio-image-url" className={labelClass}>
                  Image URL
                </label>
                <input
                  id="portfolio-image-url"
                  type="url"
                  maxLength={PROFESSIONAL_IMAGE_URL_MAX_LENGTH}
                  value={form.imageUrl}
                  onChange={update('imageUrl')}
                  placeholder="https://example.com/project.jpg"
                  data-testid="input-portfolio-image-url"
                  className={fieldClass}
                />
              </div>
            </div>

            {message ? (
              <div
                className={`rounded-xl border p-3 text-sm ${
                  message.kind === 'error'
                    ? 'border-accent/30 bg-accent/10'
                    : 'border-border bg-muted/40'
                }`}
                aria-live="polite"
                data-testid={`status-portfolio-${message.kind}`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                data-testid="button-save-portfolio"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isPending
                  ? 'Saving...'
                  : isEditing
                    ? 'Save project changes'
                    : 'Add project'}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={cancelEditing}
                  data-testid="button-cancel-portfolio"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold"
                >
                  <X className="size-4" />
                  Cancel
                </button>
              ) : null}
            </div>

            <p className="flex items-start gap-2 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-accent" />
              Paste a public http or https image link. File uploads arrive in a later phase.
            </p>
          </form>
        </>
      )}
    </section>
  );
}
