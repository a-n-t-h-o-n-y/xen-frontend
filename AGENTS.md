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

## UI Design Principles
Use these principles for all new UI and when refactoring existing interfaces.

1. Spacing & Layout System
- Use a consistent spacing scale (4px or 8px increments).
- Keep outer padding larger than inner padding.
- Keep section gaps larger than element gaps.
- Keep related elements closer together than unrelated ones.
- Prefer Flexbox/Grid over manual positioning.
- Avoid arbitrary pixel values; use design tokens.

2. Visual Hierarchy
- Use size, weight, contrast, and position to indicate importance.
- Larger elements imply higher importance.
- Stronger contrast draws attention.
- Limit emphasis levels (primary, secondary, tertiary).
- Avoid making all elements visually loud.

3. Clear Grouping
- Group related elements with spacing first.
- Use subtle backgrounds or light borders only when needed.
- Avoid excessive dividers and heavy separators.
- Keep grouping obvious without adding clutter.

4. Alignment Consistency
- Align content to a consistent invisible grid.
- Keep most text left-aligned.
- Keep similar controls at consistent heights.
- Avoid near-alignment; minor misalignment lowers perceived quality.

5. Typography Simplicity
- Use at most 1-2 font families.
- Use a small, consistent type scale.
- Limit font weights to 2-3 levels.
- Keep default text size readable.
- Create hierarchy through scale/weight, not decoration.

6. Color Discipline
- Use a neutral base palette.
- Define a single primary accent color.
- Use semantic colors consistently (success, warning, error).
- Avoid unrelated accent colors.
- Use color to communicate state before decoration.

7. Clear Interaction States
- Define hover, active, focus, selected, and disabled states.
- Ensure interactive elements visibly respond to input.
- Make disabled elements clearly non-interactive.
- Do not rely on color alone to indicate state.

8. Reduce Visual Noise
- Prefer clean, minimal surfaces.
- Avoid unnecessary gradients, shadows, and heavy borders.
- Use spacing and contrast before adding effects.
- Remove non-functional decoration.

9. Consistent Component Patterns
- Keep similar components visually and behaviorally consistent.
- Standardize buttons, inputs, toggles, and panels.
- Define reusable components early.
- Avoid one-off visual styles.

10. Density Balance
- Use slightly more spacing than feels immediately necessary.
- Separate major sections clearly.
- Keep compact areas internally consistent.
- Avoid cramming unrelated controls together.

11. Motion & Transitions
- Use subtle transitions (150-250ms).
- Use easing for natural motion.
- Animate state changes, not decoration.
- Avoid excessive or distracting motion.

12. Information Prioritization
- Identify the interface primary task first.
- Make primary content visually dominant.
- Keep secondary information supportive.
- Avoid giving equal visual weight to all elements.

General Rule: Clarity > Consistency > Simplicity > Aesthetic detail.

## CSS Organization
- Keep CSS files clean, readable, and easy to scan.
- Write CSS so a person with limited familiarity with CSS can still follow it.
- Group rules in a logical order (layout, spacing, typography, color, state, responsive).
- Add short, useful comments to separate sections and explain non-obvious decisions.
- Keep naming and structure consistent across files.
- Prefer small, focused style blocks over long, mixed-purpose sections.
