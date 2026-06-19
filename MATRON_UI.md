# Matron UI Conventions

Matron is maintained as a product fork of Element Web. Keep interface changes easy
to rebase by isolating Matron-specific work and keeping upstream-file edits small.

## CSS Overrides

- Put Matron-only visual styling under `res/css/matron/`.
- Import Matron override entrypoints at the end of `res/css/_components.pcss` so
  they win over upstream component styles without editing those styles directly.
- Prefer overriding stable shared classes, tokens, and configuration before
  changing React component structure.

## TypeScript

- Put Matron-only TypeScript helpers and constants under `src/matron/`.
- When an upstream file needs to call Matron code, keep the edit as small as
  possible and mark it with `// [MATRON]` when the hook is not self-evident.
- Keep custom Matrix event names centralised instead of repeating string literals.

## Configuration

- Use desktop/web config for branding, feature visibility, and product defaults
  whenever the setting system supports it.
- Prefer non-locking defaults for user preferences: account or device settings
  should still be able to override Matron defaults where appropriate.

## Upstream Sync

- Pull Element changes into a dedicated sync branch first, then merge that into
  the Matron product branch.
- During conflicts, preserve Matron override files and tiny integration hooks.
  Avoid reapplying large one-off edits to upstream files when a config or override
  can express the same product decision.
