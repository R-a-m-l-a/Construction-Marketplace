import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ClerkProvider,
  Show,
  SignIn,
  SignUp,
  useClerk,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  About,
  Assistant,
  CalculatorPage,
  Dashboard,
  Home,
  Marketplace,
  Professionals,
  Projects,
} from '@/pages/buildora-pages';
import {
  Route,
  Redirect,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/professionals" component={Professionals} />
        <Route path="/projects" component={Projects} />
        <Route path="/assistant" component={Assistant} />
        <Route path="/calculator" component={CalculatorPage} />
        <Route path="/about" component={About} />
        <Route path="/dashboard" component={ProtectedDashboard} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ProtectedDashboard() {
  return (
    <>
      <Show when="signed-in">
        <Dashboard />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function SignInPage() {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#ece9df] px-4 py-10">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#ece9df] px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== userId
      ) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={{
        theme: shadcn,
        cssLayerName: 'clerk',
        options: {
          logoPlacement: 'inside',
          logoLinkUrl: basePath || '/',
          logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
        },
        variables: {
          colorPrimary: 'hsl(174 42% 21%)',
          colorForeground: 'hsl(174 42% 15%)',
          colorMutedForeground: 'hsl(174 11% 42%)',
          colorDanger: 'hsl(9 68% 55%)',
          colorBackground: 'hsl(43 25% 96%)',
          colorInput: 'hsl(43 25% 98%)',
          colorInputForeground: 'hsl(174 42% 15%)',
          colorNeutral: 'hsl(174 13% 76%)',
          fontFamily: 'DM Sans, sans-serif',
          borderRadius: '0.75rem',
        },
        elements: {
          rootBox: 'w-full flex justify-center',
          cardBox: 'bg-[#f8f7f2] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
          card: '!shadow-none !border-0 !bg-transparent !rounded-none',
          footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
          headerTitle: 'font-display text-primary',
          headerSubtitle: 'text-muted-foreground',
          socialButtonsBlockButtonText: 'font-semibold text-primary',
          formFieldLabel: 'font-semibold text-primary',
          footerActionLink: 'font-semibold text-accent',
          footerActionText: 'text-muted-foreground',
          dividerText: 'text-muted-foreground',
          alertText: 'text-primary',
          logoBox: 'mb-4',
          logoImage: 'max-h-10',
          socialButtonsBlockButton: 'border-border bg-background',
          formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
          formFieldInput: 'border-border bg-background text-primary',
          footerAction: 'border-border',
          dividerLine: 'bg-border',
          alert: 'border-accent/30 bg-accent/10',
          otpCodeFieldInput: 'border-border bg-background text-primary',
          formFieldRow: 'gap-2',
          main: 'gap-4',
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back',
            subtitle: 'Sign in to return to your planning desk',
          },
        },
        signUp: {
          start: {
            title: 'Create your Buildora account',
            subtitle: 'Keep your building decisions in one place',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Router />
    </ClerkProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkProviderWithRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
