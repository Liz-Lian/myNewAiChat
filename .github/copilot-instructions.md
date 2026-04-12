# Copilot Workspace Instructions

This file mirrors the highest-signal repo guidance for Copilot. Treat [AGENTS.md](../AGENTS.md) as the source of truth when in doubt.

## Core Facts

- Next.js 16 App Router project with TypeScript, ESLint, Tailwind CSS, Prisma, and Zustand.
- TypeScript is strict.
- Module alias `@/*` maps to the repo root.
- Prisma client is generated into `app/generated/prisma`.
- Chat UI is split across `app/features/chat/`, `components/`, and `app/api/chat/`.

## Commands

- `npm run dev` starts the app locally.
- `npm run build` creates a production build.
- `npm run start` runs the built app.
- `npm run lint` runs ESLint.
- `npm run prisma:generate` regenerates the Prisma client.
- `npm run prisma:push` syncs the schema to the database.
- `npm run prisma:migrate` creates or applies migrations.
- `npm run prisma:studio` opens Prisma Studio.

## Conventions

- Use semicolons and single quotes in TypeScript, TSX, and JS files.
- Keep imports ordered as external packages, then `@/` aliases, then relative imports.
- Prefer function components and small, explicit modules.
- Do not use `any`, `@ts-ignore`, or `@ts-expect-error`.
- Model chat roles with `role: 'user' | 'assistant'` unions.
- Use `cn()` from [lib/utils.ts](../lib/utils.ts) for conditional Tailwind class names.

## Chat Architecture

- [app/api/chat/route.ts](../app/api/chat/route.ts) forwards streamed responses from SiliconFlow.
- [app/features/chat/store/useChatStore.ts](../app/features/chat/store/useChatStore.ts) owns message state and SSE chunk parsing.
- [components/layouts/chat-layout.tsx](../components/layouts/chat-layout.tsx) composes the sidebar, header, and main chat area.
- Keep feature state close to the feature and preserve the existing streaming and loading behavior unless a task explicitly changes it.

## Documentation

- Prefer linking to existing docs instead of duplicating them.
- [README.md](../README.md) is generic Next.js scaffold text and is less useful than [AGENTS.md](../AGENTS.md) for repo-specific guidance.

## If Unsure

- Check the nearest file with the same responsibility.
- Follow the local pattern exactly.
- Verify narrow changes with the smallest useful command, usually `npx eslint <file>` or `npm run build` when broader validation is needed.
