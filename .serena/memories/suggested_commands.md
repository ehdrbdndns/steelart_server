# Suggested commands
- `pnpm typecheck` / `pnpm build`: TypeScript check.
- `pnpm test`: unit tests via `tsx --test tests/unit/*.test.ts tests/unit/**/*.test.ts`.
- `pnpm test:integration`: integration tests, single concurrency.
- `pnpm test:integration:env`: integration tests with `.env.integration`.
- `pnpm lint`: placeholder lint command currently prints a message.
- `pnpm sam:validate`: validate SAM template.
- `pnpm sam:build`: build SAM app.
- `pnpm sam:deploy:guided`: guided dev deploy after SAM build.
- Useful local tools on Darwin: `rg`, `rg --files`, `find`, `sed`, `git status --short`, `git diff --stat`.