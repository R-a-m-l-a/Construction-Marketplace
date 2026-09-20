# Buildora

Buildora is a free-first construction discovery app for finding materials, professionals, and clearer next steps in Pakistan.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/buildora run dev` — run the Buildora web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required auth is provisioned through Replit-managed Clerk.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/buildora/src/pages/buildora-pages.tsx` — public routes and first-phase product surfaces
- `artifacts/buildora/src/components/buildora-shell.tsx` — shared navigation, footer, loading, error, and demo states
- `artifacts/api-server/src/routes/discovery.ts` — typed discovery endpoints and clearly marked fictional demo content
- `lib/api-spec/openapi.yaml` — source of truth for discovery API contracts
- `artifacts/buildora/src/index.css` — Buildora visual tokens and responsive styling

## Architecture decisions

- Buildora is an original product identity, not a visual or content copy of Tameer.AI.
- The MVP is free-first: Replit-managed Clerk handles auth; paid Google Maps and OpenAI are not required for the first tester group.
- Demo marketplace and professional records are fictional and visibly labeled; real-world discovery will use a free map/search adapter in a later phase.
- The first phase uses typed API endpoints so the homepage and directories are not static mockups.

## Product

Phase 1 includes a public home page, marketplace and professional directory previews, project brief preview, branded Clerk sign-in/sign-up, a protected planning desk, responsive navigation, and typed discovery API data.

## User preferences

- The user wants a genuinely testable MVP for 5–6 real users without paying for subscriptions.
- Prioritize functionality, real data, reliability, and low API cost over feature breadth.

## Gotchas

- Do not present fictional demo listings as real businesses.
- Keep unauthenticated users on the public home route; authenticated users can use the planning desk.
- Regenerate API clients after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
