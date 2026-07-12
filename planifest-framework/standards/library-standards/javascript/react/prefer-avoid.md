# JavaScript — React — Library Standards

> See `_version-policy.md` for pinning rules. Check `planifest-overrides/library-standards/javascript/react/prefer-avoid.md` first.
> Also applies to TypeScript React projects. TypeScript projects should additionally follow `typescript/prefer-avoid.md`.

---

## State Management

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Server state / data fetching | `TanStack Query` (v5) | `SWR`, `RTK Query` | TanStack Query is framework-agnostic, has best devtools and cache invalidation |
| Client / UI state | `zustand` | `redux`, `redux-toolkit` (unless large legacy app), `recoil`, `jotai` | Zustand is minimal, no boilerplate, TS-friendly |
| Form state | `react-hook-form` + `zod` | `formik`, `final-form` | RHF has better performance (uncontrolled inputs) and zod integration |

## UI Components

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Component library | `shadcn/ui` + `tailwind v4` | `MUI`, `Chakra UI`, `Ant Design` | shadcn/ui ships unstyled primitives you own; others create upgrade lock-in |
| Styling | `tailwind v4` | `styled-components`, `emotion`, CSS-in-JS | Tailwind v4 is faster (Rust engine), no runtime overhead |
| Icons | `lucide-react` | `react-icons` (bloated bundle), `font-awesome` | Lucide is tree-shakeable and consistent |
| Animation | `framer-motion` | `react-spring`, `GSAP` (unless complex) | Framer Motion has the best React integration |

## Routing

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Client-side routing | `react-router v7` or framework-native | `reach/router` (archived) | React Router v7 merges with Remix patterns |
| Meta-framework | `Next.js 15` (App Router) or `Vite` + RR | `Create React App` (unmaintained) | CRA is unmaintained since 2023 |

## Patterns

| Rule | Detail |
|------|--------|
| No class components | Use function components and hooks only |
| No `useEffect` for data fetching | Use TanStack Query |
| No prop drilling > 2 levels | Use zustand or component composition |
| No `any` in TypeScript React | Use `unknown` and narrow |
