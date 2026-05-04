# Copilot Workspace Instructions

This file mirrors the highest-signal repo guidance for Copilot. Treat [AGENTS.md](../AGENTS.md) as the source of truth when in doubt.

## Core Facts

- Next.js 16 App Router project with React 19, TypeScript strict, ESLint, Tailwind CSS 4, Prisma 7, PostgreSQL, Zustand, and SiliconFlow.
- Module alias `@/*` maps to the repo root.
- Prisma client is generated into `app/generated/prisma`.
- Server-only auth, db, and repository code lives under `server/`.
- Chat UI is split across `app/page.tsx`, `app/features/chat/`, and `components/`.
- Chat streaming is handled by `app/api/chat/route.ts`, `lib/chat-sse.ts`, and `app/features/chat/store/useChatStore.ts`.

## Progressive Disclosure

Read [AGENTS.md](../AGENTS.md) first, then open the task-specific docs only when needed:

- Project map: [docs/project-map.md](../docs/project-map.md)
- Frontend tasks: [docs/frontend-guide.md](../docs/frontend-guide.md)
- API tasks: [docs/api-guide.md](../docs/api-guide.md)
- Database tasks: [docs/database-guide.md](../docs/database-guide.md)
- Auth tasks: [docs/auth-guide.md](../docs/auth-guide.md)
- AI, SSE, and voice tasks: [docs/ai-voice-guide.md](../docs/ai-voice-guide.md)
- Code review: [docs/code-review-guidelines.md](../docs/code-review-guidelines.md)
- Large refactors: [.agents/PLANS.md](../.agents/PLANS.md)

## Commands

- `npm run dev` starts the app locally.
- `npm run build` creates a production build.
- `npm run start` runs the built app.
- `npm run lint` runs ESLint.
- `npx eslint <path>` lints one file or folder.
- `npm run db:generate` or `npm run prisma:generate` regenerates Prisma client.
- `npm run db:push` or `npm run prisma:push` syncs schema to the database.
- `npm run db:migrate` or `npm run prisma:migrate` creates and applies migrations.
- `npm run db:seed` runs seed.

## Conventions

- Use semicolons and single quotes in TypeScript, TSX, and JS files.
- Keep imports ordered as external packages, then `@/` aliases, then relative imports.
- Do not use `any`, `@ts-ignore`, or `@ts-expect-error`.
- Use `zod` for API payload validation and structured JSON errors.
- Keep Prisma queries in `server/repositories/`; route handlers should orchestrate.
- Use `cn()` from [lib/utils.ts](../lib/utils.ts) for conditional Tailwind class names.
- Preserve streaming, loading, abort, and retry behavior unless the task explicitly changes it.

## If Unsure

- Check the nearest file with the same responsibility.
- Follow local patterns over generic framework assumptions.
- Verify narrow changes with the smallest useful command, usually `npx eslint <file>`.
