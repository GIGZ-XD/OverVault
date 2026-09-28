## What & why
<!-- One or two sentences. Link the issue if there is one. -->

## Area (tick all that apply)
- [ ] backend  - [ ] contracts / chain  - [ ] wallet / auth  - [ ] frontend  - [ ] e2e / docs  - [ ] specs / tooling

## Checklist
- [ ] Branch is `feature/<name>-...` and rebased on latest `main`
- [ ] Commit messages follow `type: summary` (e.g. `feat: add approvals route`)
- [ ] CI is green (tests, lint/type-check for my area)
- [ ] No `.env`, private keys or seed phrases in the diff
- [ ] Layer rules respected (routes -> services -> models; chain only via `ChainService`; no on-chain writes inside a request)

## Frozen-contract changes
<!-- Delete this section if you did not touch specs/. -->
- [ ] `specs/openapi.yaml` + `specs/fixtures/` updated **in this same PR**
- [ ] Every consumer updated (backend schemas, `lib/api` types, MSW mocks, signing payloads)
- [ ] Owners on both sides tagged for review

## How I tested
<!-- Commands run / screenshots / MSTScan links. -->
