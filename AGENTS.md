# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite + React + TypeScript frontend.

- `src/`: application source code.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: root UI component (current scaffold).
- `src/assets/`: static assets imported by code.
- `public/`: files served as-is at the web root.
- `dist/`: production build output (generated; do not edit manually).

Keep components and related styles close together in `src/` as features are added.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server with HMR.
- `npm run build`: type-check (`tsc -b`) and create a production build.
- `npm run lint`: run ESLint across the project.
- `npm run preview`: serve the built app locally for verification.

Use `npm run lint && npm run build` before opening a PR.

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`/`.tsx`) with React functional components.
- Follow ESLint config in `eslint.config.js` (TypeScript + React Hooks + React Refresh rules).
- Match existing style: single quotes and no semicolons.
- Naming:
  - Components: `PascalCase` (example: `UserCard.tsx`).
  - Variables/functions: `camelCase`.
  - Test files: `*.test.ts` or `*.test.tsx`.

Prefer small, focused components and explicit prop types.

## Testing Guidelines
There is currently no test runner configured in `package.json`.

For now, treat lint + build as required quality gates:
- `npm run lint`
- `npm run build`

If you add tests, use Vitest with React Testing Library and place tests beside source files or under `src/__tests__/`.

## Commit & Pull Request Guidelines
Current history uses concise, imperative commit subjects (example: `Scaffold frontend (Vite + React + TS)`).

- Keep commit messages short, specific, and action-oriented.
- Prefer one logical change per commit.
- PRs should include:
  - clear summary of what changed and why,
  - linked issue/ticket (if available),
  - screenshots or short video for UI changes,
  - validation steps (commands run, e.g., lint/build).
