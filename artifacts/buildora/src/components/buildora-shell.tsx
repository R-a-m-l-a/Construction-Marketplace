import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { ArrowRight, Building2, Menu, X } from "lucide-react";

const navItems = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/professionals", label: "Professionals" },
  { href: "/projects", label: "Post a project" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" data-testid="link-logo" className="group inline-flex items-center gap-2.5">
      <span className={`grid size-9 place-items-center rounded-[10px] ${light ? "bg-secondary text-primary" : "bg-primary text-secondary"} transition-transform group-hover:-rotate-6`}>
        <Building2 className="size-[18px]" strokeWidth={2.3} />
      </span>
      <span className={`font-display text-[22px] font-bold tracking-[-0.04em] ${light ? "text-background" : "text-foreground"}`}>buildora</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const isActive = (href: string) => location.startsWith(href);

  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`} className={`relative py-2 text-sm font-semibold transition-colors hover:text-accent ${isActive(item.href) ? "text-foreground" : "text-muted-foreground"}`}>
                {item.label}
                {isActive(item.href) && <span className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-secondary" />}
              </Link>
            ))}
            <Link href="/about" data-testid="link-nav-about" className={`text-sm font-semibold transition-colors hover:text-accent ${isActive("/about") ? "text-foreground" : "text-muted-foreground"}`}>About</Link>
          </nav>
          <div className="hidden items-center gap-2.5 md:flex">
            <Show when="signed-out">
              <Link href="/sign-in" data-testid="link-sign-in" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Sign in</Link>
              <Link href="/projects" data-testid="link-header-cta" className="group inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">Start planning <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></Link>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" data-testid="link-dashboard" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{user?.firstName ? `Hi, ${user.firstName}` : "Dashboard"}</Link>
              <button type="button" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })} data-testid="button-sign-out" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">Sign out</button>
            </Show>
          </div>
          <button type="button" onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-lg border border-border md:hidden" aria-label={open ? "Close menu" : "Open menu"} data-testid="button-mobile-menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-border bg-card px-5 py-4 md:hidden">
            <nav className="mx-auto flex max-w-[1240px] flex-col gap-1" aria-label="Mobile navigation">
              {navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} data-testid={`link-mobile-${item.label.toLowerCase().replaceAll(" ", "-")}`} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">{item.label}</Link>)}
              <Link href="/about" onClick={() => setOpen(false)} data-testid="link-mobile-about" className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted">About Buildora</Link>
              <Link href="/sign-in" onClick={() => setOpen(false)} data-testid="link-mobile-sign-in" className="mt-2 rounded-lg bg-primary px-3 py-3 text-center text-sm font-bold text-primary-foreground">Sign in</Link>
            </nav>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-6 text-primary-foreground/65">A clearer starting point for building in Pakistan. Search less. Decide better.</p>
          </div>
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-secondary">Explore</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-primary-foreground/75">
              <Link href="/marketplace" data-testid="link-footer-marketplace" className="hover:text-secondary">Materials marketplace</Link>
              <Link href="/professionals" data-testid="link-footer-professionals" className="hover:text-secondary">Find professionals</Link>
              <Link href="/projects" data-testid="link-footer-projects" className="hover:text-secondary">Post a project</Link>
            </div>
          </div>
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-secondary">Next phase</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-primary-foreground/75">
              <Link href="/assistant" data-testid="link-footer-assistant" className="hover:text-secondary">Buildora Assistant</Link>
              <Link href="/calculator" data-testid="link-footer-calculator" className="hover:text-secondary">Cost calculator</Link>
              <Link href="/about" data-testid="link-footer-about" className="hover:text-secondary">Our approach</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10 px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-2 text-[11px] text-primary-foreground/45 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2025 Buildora. Built for the first brick and every decision after.</span>
            <span className="font-mono-ui uppercase tracking-wider">Pakistan / early access</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono-ui text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{children}</p>;
}

export function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-12 sm:px-8 md:pb-14 md:pt-20">
      <SectionLabel>{eyebrow}</SectionLabel>
      <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.03] tracking-[-0.055em] sm:text-6xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{body}</p>
    </div>
  );
}

export function DemoTag() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-secondary/60 bg-secondary/15 px-2 py-1 font-mono-ui text-[9px] font-bold uppercase tracking-[0.14em] text-primary">Demo content</span>;
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: count }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl border border-border bg-muted/60" />)}</div>;
}

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return <div className="rounded-2xl border border-accent/35 bg-accent/10 p-6 text-center"><p className="font-semibold">This desk is taking a short pause.</p><p className="mt-1 text-sm text-muted-foreground">We could not load the latest listings. Try once more.</p><button type="button" onClick={onRetry} data-testid="button-retry" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Try again</button></div>;
}