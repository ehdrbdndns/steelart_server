# Completion checklist
- Run focused tests for touched domain; for broad changes run `pnpm test` and `pnpm typecheck`.
- If API Gateway/SAM resources change, run `pnpm sam:validate` and consider `pnpm sam:build`.
- Verify API contract changes against `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md` and update docs together when required.
- Do not revert unrelated user changes in the working tree.