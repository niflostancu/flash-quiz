# AGENTS.md — working agreement for FQuiz

This file is the operating manual for any LLM/agent working on FQuiz. Read it fully before
touching code. The requirements live in [`Initial.md`](./Initial.md) (treat as the product
spec); the step-by-step plan lives in [`TODO.md`](./TODO.md) (treat as the work ledger).

---

## 1. Session protocol (read this first)

At the start of every session, in this order:

1. Read `.agents/AGENTS.md` (this file), `.agents/Initial.md`, `.agents/TODO.md`.
2. Run `git log --oneline -5`, `git status --short`, and `git diff --stat`. The maintainer
   edits and commits manually — the working tree may differ from what the previous session
   left behind.
3. Identify the step you were asked to do. If the request does not name a step ID
   (`Sxx`), find the matching unchecked step and confirm it with the maintainer.
4. Read **every file you are about to modify** and any directly imported module. Do not
   rely on a remembered copy: the maintainer may have hand-edited it.

Then work on exactly **one step**. When it is verifiably done, stop and report. Do not
start the next step, do not "fix while I'm here", do not refactor adjacent code.

### The one-step contract

- **Scope:** only the files/behaviour named in the step. Extra changes must be proposed,
  not made. If the step turns out to be wrong, stop and say so.
- **Non-breaking:** after your change, `npm run typecheck`, `npm test`, and `npm run check`
  must pass. A step that only adds files must leave the build green.
- **Atomic:** the diff should be reviewable in one sitting and revertible as one commit.
- **Verify before reporting:** run the step's `Verify` commands yourself; paste the real
  output (or the failure) in your report.
- **Never commit, stage, tag, push, or amend.** The maintainer inspects and commits
  manually. Never tick a checkbox in `TODO.md`; the maintainer does that after committing.
- **Report format:** what changed (files), why, how verified, anything the maintainer must
  know (decisions taken, follow-ups), and the suggested commit message from the step.
- **After the maintainer commits/edits:** the next step starts by re-reading the changed
  files. If their edit contradicts the plan, adapt the *plan* first (ask), then code.

If you are blocked by an ambiguity that changes user-visible behaviour, stop and ask one
focused question. Do not guess product requirements; do guess implementation details that
are cheap to change and mention the guess.

---

## 2. What FQuiz is

A Kahoot-style, teacher-driven flash quiz for university classrooms. Three surfaces, one
origin:

| Path | Who | Purpose |
|------|-----|---------|
| `/` | students (phone) | join with a username, then answer with letter buttons or a text/number field |
| `/display` | projector | waiting screen with the join URL, then the current question + countdown |
| `/admin` | teacher | start/pause/resume/end/reset, joined-student list, diagnostics |

The server is the single source of truth: it owns the phase, the current question and the
answer deadline. Answers are append-only history in SQLite with server timestamps. There is
no grading in the app — only a CSV export consumed by a separate grader.

---

## 3. Stack and fixed technical decisions

| Concern | Decision |
|---------|----------|
| Language | TypeScript, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, ESM everywhere. Pinned to 6.0.3: `vue-tsc` cannot use the TS 7 native compiler (see TODO D14) |
| Backend | Hono on `@hono/node-server`, bundled with esbuild |
| Frontend | Vue 3 (`<script setup lang="ts">`) + Vite + Tailwind CSS v4 |
| Shared code | `common/` — types, quiz parser, wire protocol, i18n. **No Node APIs** (it is bundled into the browser) |
| DB | built-in `node:sqlite` (`DatabaseSync`), plain SQL, numbered migrations. No ORM |
| Realtime | WebSocket via `upgradeWebSocket` from `@hono/node-server` + `ws` (`WebSocketServer({noServer:true})`). `@hono/node-ws` is deprecated — do not use it |
| Routing (frontend) | `location.pathname` switch in `App.vue`. No vue-router |
| Markdown render | `markdown-it` with `html:false`, rendered only through `MarkdownView.vue` |
| i18n | hand-written typed dictionaries (`en` is the key source, `ro` must match). Student UI only |
| Tests | `node:test` + `tsx`, colocated `*.test.ts`. No Vitest/Jest |
| Lint/format | Biome (double quotes, 2 spaces, 100 cols) |
| TLS | terminated by a reverse proxy. Never add TLS/cert handling to the server |
| Paths | quiz file = CLI arg; everything writable under `data/` (gitignored, configurable) |

Dependencies: add one only when the step requires it and it is already listed in
`TODO.md`/this table. Anything else needs the maintainer's approval first. Prefer the
platform (Node 24, `node:sqlite`, Web Crypto) over a package.

---

## 4. Repository layout and ownership

```
.agents/            requirements, plan, this file (agent-owned docs)
bin/                CLI entrypoints: fquiz, fquiz-parse, fquiz-export
common/src/quiz/    Quiz types + markdown parser + validation + public projection
common/src/protocol/ wire types + inbound guards
common/src/i18n/    EN/RO dictionaries
backend/src/        config, db, quiz loading, session engine, http routes, ws hub, csv export
backend/src/index.ts  bootstrap ONLY (wire deps, start server, graceful shutdown)
frontend/           pages/, components/, lib/ (api, ws, session, storage)
data/               runtime SQLite files (never committed)
docs/               quiz format, deployment, QA
```

Rules:
- **Dependency direction:** `bin → backend/common`, `backend → common`, `frontend → common`.
  Never import backend code from the frontend, never import `node:*` from `common`.
- `index.ts` stays a thin composition root. Business logic belongs in `session/`, `db/`,
  `http/`, `ws/` and must be testable without a real socket or port.
- Hono handlers are adapters: validate → call a service → map to a response. No SQL and no
  state-machine rules in handlers.
- One owner per concern: SQL only in `backend/src/db/`; state transitions only in
  `session/engine.ts`; public payloads only from `common/src/quiz/public.ts`; clock offset
  only in `frontend/lib/clock.ts`.
- Do not flatten/rename the existing top-level structure (`common/`, `backend/`,
  `frontend/`, `bin/`). Keep frontend entry files at `frontend/` root per decision D1.

---

## 5. Commands

```bash
npm ci                  # install exactly the lockfile (preferred)
npm run dev             # backend (tsx watch) + frontend (vite), concurrently
npm run dev:backend
npm run dev:frontend
npm run build           # vite build → backend/dist/public, then esbuild backend/bin
npm start               # run the built server
npm run typecheck       # tsc/vue-tsc for all three workspaces
npm test                # node:test + tsx
npm run test:e2e        # spawned-server integration test (later)
npm run check           # biome check (lint + format check)
npm run format          # biome check --write
npm run quiz:parse -- <quiz.md>
npm run export -- <args>
```

Server: `fquiz --quiz <quiz.md> [--config <file>] [--port N]`. Config resolution order:
`--config` → `FQUIZ_CONFIG` → `./config.yaml` → `./backend/config.yaml`. `backend/config.yaml`
is local and gitignored; `backend/config.sample.yaml` is the committed template. Never commit
a real config, DB, `.env`, or build output.

---

## 6. Verification and done-ness

A step is done only when:

1. `npm run typecheck` passes.
2. `npm test` passes (new behaviour has a test; bug fixes get a regression test).
3. `npm run check` passes (run `npm run format` first if needed).
4. The step's own `Verify` command(s) were executed and their result is reported.
5. No debug logging, commented-out code, or unused exports remain.
6. `git status` shows only files within the step's scope.

Testing rules:
- Test business logic, not frameworks. Parser, validator, engine, repositories, guards,
  reducers, CSV — these must be covered.
- No `setTimeout`-based sleeps in tests; use `node:test` mock timers.
- No fixed ports; no shared DB files — `mkdtemp` per test and clean up.
- Frontend tests are limited to pure logic (`lib/*.ts`); UI is verified manually.

---

## 7. Behavioural invariants (do not break these)

1. **Server authority for time.** Clients never decide whether an answer is late. Accept
   only when `phase === "question"` and `now <= deadlineMs`; the timestamp is the server's
   receipt time.
2. **Append-only answers.** Every accepted change is a new row with `client_ts` and
   `server_ts`. Never `UPDATE`/`DELETE` an answer. `--latest` is a *query*, not a mutation.
3. **No leakage.** Public/display payloads never contain `answer` or `comment`. Build them
   only with `common/src/quiz/public.ts`; a hand-built payload is a bug.
4. **Restore must be lossless.** A refresh, background/foreground cycle, or reconnect must
   re-`join` and repopulate the student's previous answers from the server.
5. **Mobile WS is unreliable by default.** Any connection logic must include:
   `visibilitychange` force-reconnect (iOS keeps zombie sockets), a 5 s client `ping` **only
   while the tab is visible**, a 15 s client watchdog (3 missed beats) that forces a reconnect,
   server-side `lastSeen` sweep (idle > 20 s → close), reconnect on `online`, backoff with
   jitter, and a "reconnecting" UI state. Every answer is acked within 1.5 s or resent with the
   same `clientSeq` over the HTTP fallback. See `TODO.md` → Platform notes.
6. **One WebSocket broadcast per transition.** Do not poll or push a `state` frame per
   second; countdowns are computed locally from `deadlineMs` + measured clock offset.
7. **No secrets in URLs or logs.** Admin key goes in a header; never log usernames with
   answers, never log the key.
8. **Simplest thing that fully works.** No new abstraction for a single call site, no state
   library, no plugin system, no feature flags. If a file grows past ~200 lines, split by
   concern only when the step says so.

---

## 8. Code style

- Biome is the formatter and linter; do not hand-format against it.
- Prefer `type` imports (`import type { X } from ...`) and `satisfies` over casts.
- Discriminated unions with a `kind`/`type` field for variants; exhaustive `switch` with a
  `never` check.
- Errors: throw typed errors at the service boundary; map to `{ error: { code, message } }`
  at the HTTP/WS edge. Codes are `E_SCREAMING_SNAKE`, stable, and documented where used.
- Timestamps: epoch milliseconds (`number`) in storage and on the wire; ISO strings only in
  CSV/docs.
- Vue: `<script setup lang="ts">`, props typed with `defineProps<T>()`, no `any`, no direct
  `fetch` in components (use `lib/api.ts`), no `v-html` outside `MarkdownView.vue`.
- Tailwind only for styling; add design tokens in `assets/style.css` `@theme`. No CSS
  framework besides Tailwind, no shadows/gradients/3D.
- Comments explain *why*, not *what*. Keep files ASCII unless the file already has accents
  (i18n dictionaries).

---

## 9. Git conventions (maintainer performs the commit)

Commit messages follow the `TODO.md` line for the step:

```
area: lowercase imperative summary
```

`area` ∈ `common | backend | frontend | bin | devcontainer | docs | build | test | chore`.
One step = one commit. If a step needs a follow-up fix, it becomes a new step (or an
amend — the maintainer's call), not a second unrelated change.

---

## 10. Never do these

- Never commit, stage, push, amend, rebase, or tick `TODO.md` checkboxes.
- Never edit `.agents/Initial.md` (it is the requirement record; propose changes instead).
- Never add an editor, CRUD, grading, accounts, or another quiz format.
- Never add TLS, an ORM, a state-management library, vue-router, or a test framework.
- Never rewrite history, `git checkout --` the maintainer's work, or delete files outside
  the step's scope.
- Never "fix" a failing step by weakening a test or loosening `strict`/Biome rules.
- Never run the dev server in the foreground of a tool call without a timeout; never leave
  background processes running after a step.
