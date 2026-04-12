<!-- BEGIN:nextjs-agent-rules -->

# AGENTS.md

This repository is a Next.js 16 app with TypeScript, ESLint, Tailwind CSS, Prisma, and Zustand.
Use this file as the source of truth when coding in this repo.

## Project facts

- App Router project.
- TypeScript is strict.
- Module alias: `@/*` maps to the repo root.
- Package manager scripts live in `package.json`.
- Prisma client output is generated into `app/generated/prisma`.
- No `.cursor/rules/` or `.cursorrules` files were present.
- A Copilot-facing mirror lives at [`.github/copilot-instructions.md`](.github/copilot-instructions.md).

## Read first

- This version of Next.js may differ from older docs and examples.
- If behavior seems surprising, check `node_modules/next/dist/docs/` before changing code.
- Prefer local repo patterns over generic Next.js assumptions.

## Common commands

### Development

- `npm run dev` — start the dev server.
- `npm run build` — production build.
- `npm run start` — run the built app.

### Linting

- `npm run lint` — run ESLint across the repo.
- `npx eslint <path>` — lint a single file or folder.
- `npx eslint <path> --fix` — auto-fix a targeted file.

### Prisma

- `npm run prisma:generate` — regenerate the Prisma client.
- `npm run prisma:push` — sync schema to the database.
- `npm run prisma:migrate` — create/apply a migration.
- `npm run prisma:studio` — open Prisma Studio.

## Single-file verification

There is no dedicated test script in `package.json` yet.
For one-file checks, use the narrowest available command:

- `npx eslint <file>` for style and lint checks.
- `npx tsc --noEmit` for type-only validation when needed.
- If a future test runner is added, prefer its file filter flag for a single test file.

## Code style

- Use semicolons.
- Use single quotes in TypeScript/TSX/JS files, matching the existing code.
- Keep imports ordered as: external packages, then `@/` aliases, then relative imports.
- Prefer concise, composable modules over large monoliths.
- Keep functions small and explicit.
- Avoid clever abstractions unless they remove real duplication.

## TypeScript guidelines

- Keep `strict: true` in mind; do not weaken types to satisfy the compiler.
- Do not use `any`, `@ts-ignore`, or `@ts-expect-error`.
- Prefer explicit interfaces or type aliases for public props and state.
- Infer local values where the type is obvious.
- Model unions directly for app state like `role: 'user' | 'assistant'`.
- Use `Promise<void>` for async actions that do not return a value.

## Naming conventions

- React components use PascalCase.
- Hooks and Zustand stores use camelCase with `use` prefix.
- Route handlers follow Next.js conventions like `export async function POST()`.
- Keep file names descriptive and kebab-case where the repo already uses it.
- Use domain terms from the app: conversation, message, chat, sidebar, header, layout.

## React / Next.js conventions

- Prefer function components.
- Keep server-only code on the server.
- Keep client state in Zustand or component state, not in ad hoc globals.
- Use `app/` route files for pages and route handlers.
- Keep UI components in `components/` or feature-local `app/features/.../components` folders.
- Use `NextResponse` for JSON route responses when appropriate.

## Styling conventions

- Tailwind utility classes are the primary styling mechanism.
- Use `cn()` from `lib/utils.ts` to merge conditional class names.
- Prefer `tailwind-merge` + `clsx` over manual string concatenation.
- Keep class lists readable; group layout, spacing, color, and interaction styles logically.

## State and data flow

- Feature state lives near the feature when practical.
- Zustand stores should keep state transitions explicit.
- When streaming data, handle partial chunks carefully and keep buffer logic local.
- Preserve the existing message flow and loading-state behavior unless the task requires a change.

## Error handling

- Catch errors only when you can recover, transform, or log them usefully.
- Prefer returning structured error responses from API routes.
- Log enough context to debug, but do not leak secrets.
- Handle missing response bodies and network failures explicitly.
- Do not leave empty catch blocks.

## API and server guidance

- Read environment variables defensively.
- Never print full secrets to logs.
- Validate request payloads before using them.
- Treat external API calls as fallible and check `response.ok`.
- Return clear status codes and error bodies from route handlers.

## Prisma guidance

- Keep schema changes minimal and intentional.
- Re-run generation after schema changes.
- Prefer explicit relation fields and defaults.
- Keep model names aligned with the domain.

## Comments and documentation

- Write comments only when they add context that is not obvious from code.
- Prefer English comments for shared repo guidance.
- Avoid restating what the code already says.

## Verification expectations

- Before claiming success, run the relevant lint/type/build command.
- If a change touches a narrow area, verify that narrow area first.
- Do not delete failing tests to make a change appear green.
- Fix the root cause, not just the symptom.

## When editing this repo

- Match the existing folder structure.
- Keep diffs small and local.
- Avoid broad refactors unless explicitly requested.
- Preserve behavior unless the task is to change it.
- If you add a new pattern, keep it consistent across the repo.

## Repo-specific reminders

- The chat API route forwards streamed responses from SiliconFlow.
- The chat store parses SSE-like chunks and updates the last assistant message in place.
- UI layout is built from small reusable components under `components/` and `app/features/`.
- `lib/utils.ts` exports `cn()` as the shared class-name helper.

## If you are unsure

- Look for the nearest existing file with the same responsibility.
- Follow that file’s style exactly.
- Prefer consistency over personal preference.
<!-- END:nextjs-agent-rules -->
