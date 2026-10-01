import {
  getListPublicProfessionalProjectsQueryKey,
  useGetPublicProfessional,
  useListPublicProfessionalProjects,
} from '@workspace/api-client-react';
import type { PublicProfessionalProject } from '@workspace/api-client-react';
import { AlertCircle, ArrowLeft, Image as ImageIcon, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Link } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QuoteRequestDialog } from '@/components/quote-request-dialog';
import { callLink, whatsappLink } from '@/lib/contact-links';
import { LoadingCards, PageIntro, SectionLabel, Shell } from '@/components/qadeerbuilds-shell';

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  return candidate.status === 404 || candidate.response?.status === 404;
}

function ProjectCard({ project }: { project: PublicProfessionalProject }) {
  return (
    <article
      className="overflow-hidden rounded-2xl border border-border bg-card"
      data-testid={`public-project-${project.id}`}
    >
      {project.imageUrl ? (
        <img
          src={project.imageUrl}
          alt={project.title}
          loading="lazy"
          className="h-44 w-full object-cover"
        />
      ) : (
        <div className="grid h-44 w-full place-items-center bg-muted/40 text-muted-foreground">
          <ImageIcon className="size-7" />
        </div>
      )}
      <div className="p-5">
        <h3 className="font-display text-xl font-bold tracking-[-0.04em]">{project.title}</h3>
        {project.location ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" />
            {project.location}
          </p>
        ) : null}
        {project.description ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{project.description}</p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Phase 5C public view of a single professional and their portfolio.
 *
 * Deliberately small: the public read model plus the projects a professional
 * chose to publish. There is no contact, quote, rating or review surface here
 * (that is Phase 5D or later), and the private phone and WhatsApp values are
 * never part of either response.
 */
export function ProfessionalPublicProfile({ id }: { id: string }) {
  const professionalQuery = useGetPublicProfessional(id);
  const professional = professionalQuery.data;

  // Only meaningful once the professional exists, so it waits for the first
  // query rather than firing a request that would 404.
  const professionalId = professional?.id;
  const projectsQuery = useListPublicProfessionalProjects(id, {
    query: {
      enabled: Boolean(professionalId),
      queryKey: getListPublicProfessionalProjectsQueryKey(id),
    },
  });
  const projects = projectsQuery.data ?? [];

  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <Link
          href="/professionals"
          data-testid="link-back-professionals"
          className="inline-flex items-center gap-2 text-sm font-bold text-accent"
        >
          <ArrowLeft className="size-4" />
          All professionals
        </Link>

        {professionalQuery.isLoading ? (
          <div className="mt-6">
            <LoadingCards count={3} />
          </div>
        ) : professionalQuery.isError ? (
          isNotFound(professionalQuery.error) ? (
            <div className="mt-6" data-testid="public-professional-not-found">
              <PageIntro
                eyebrow="Professionals"
                title="We could not find that professional."
                body="The link may be out of date. Browse the directory to find someone else."
              />
            </div>
          ) : (
            <div
              className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-6"
              data-testid="status-public-professional-error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <p className="font-semibold">This profile could not be loaded.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The professional service may be temporarily unavailable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void professionalQuery.refetch()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Try again
              </button>
            </div>
          )
        ) : professional ? (
          <>
            <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <Avatar className="size-20 shrink-0 rounded-2xl">
                {professional.logoUrl ? (
                  <AvatarImage
                    src={professional.logoUrl}
                    alt={professional.name}
                    className="rounded-2xl"
                  />
                ) : null}
                <AvatarFallback className="rounded-2xl font-display text-2xl font-bold text-secondary">
                  {professional.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SectionLabel>Professional</SectionLabel>
                <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
                  {professional.name}
                </h1>
                <p className="mt-1 font-semibold text-accent">{professional.profession}</p>
                <p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                  {professional.category}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {professional.city}
                  </span>
                  {professional.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {professional.location}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
              {professional.services}
            </p>

            <div
              className="mt-6 flex flex-wrap items-center gap-3"
              data-testid="professional-contact-actions"
            >
              <QuoteRequestDialog
                professionalId={professional.id}
                professionalName={professional.name}
              />
              {professional.whatsapp?.trim() ? (
                <a
                  href={whatsappLink(professional.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="button-whatsapp"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-bold"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </a>
              ) : null}
              {professional.phone?.trim() ? (
                <a
                  href={callLink(professional.phone)}
                  data-testid="button-call-now"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-bold"
                >
                  <Phone className="size-4" />
                  Call Now
                </a>
              ) : null}
            </div>

            <div className="mt-12">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-3xl font-bold tracking-[-0.05em]">Selected work</h2>
                {!projectsQuery.isLoading ? (
                  <p className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                    {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                  </p>
                ) : null}
              </div>

              {projectsQuery.isLoading ? (
                <div className="mt-6">
                  <LoadingCards count={3} />
                </div>
              ) : projectsQuery.isError ? (
                <p
                  className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground"
                  data-testid="public-projects-error"
                >
                  This portfolio could not be loaded right now.
                </p>
              ) : projects.length ? (
                <div
                  className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  data-testid="public-projects-list"
                >
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <p
                  className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground"
                  data-testid="public-projects-empty"
                >
                  This professional has not published any projects yet.
                </p>
              )}
            </div>
          </>
        ) : null}
      </section>
    </Shell>
  );
}
