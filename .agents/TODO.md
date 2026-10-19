# FQuiz — Development Plan (step ledger)

Source of requirements: [`Initial.md`](./Initial.md). Workflow rules: [`AGENTS.md`](./AGENTS.md).

**Legend:** one checkbox = one atomic, independently committable change. Do **not** work on a
step that is not explicitly assigned by the maintainer. Never mark a box yourself — the
maintainer ticks it after reviewing and committing.

```
- [ ] Sxx  not started
- [x] Sxx  reviewed + committed by the maintainer
```

Commit message prefix convention: `area: lowercase summary` where area is one of
`common`, `backend`, `frontend`, `bin`, `devcontainer`, `docs`, `build`, `test`, `chore`.

---

## Current state (verified 2026-10-19, master @ c7fde05)

Working: npm workspaces (`common`, `frontend`, `backend`), Hono server with static serving,
Vue 3 + Vite + Tailwind 4 sample page, YAML config loader, devcontainer, Biome.

Known gaps / defects to fix early:

1. `frontend/tsconfig.json` includes `src` (does not exist) → `main.ts`/`App.vue` are never
   typechecked. No `typecheck` script in `frontend`.
2. No test runner wired up anywhere.
3. `backend/src/config/loader.ts` reads `config.yaml` from **cwd**; breaks when the server is
   started from the repo root. No CLI flags.
4. No SPA fallback: `/admin` and `/display` would 404 against `serveStatic`.
5. `backend/package-lock.json` is a stray file (workspaces use the root lockfile).
6. No `data/` directory, no DB, no WebSocket, no quiz parser, no protocols, no i18n.
7. `backend/config.yaml` is intentionally local (gitignored); only `config.sample.yaml` is
   committed.

---

## Decisions to confirm before the steps that need them

| # | Decision | Proposed default | Needed by |
|---|----------|------------------|-----------|
| D1 | Frontend layout: keep `App.vue`/`main.ts`/`assets/` at `frontend/` root and add sibling `pages/`, `components/`, `lib/`; fix tsconfig `include` to `[".", "../common/src"]`. | Yes, keep current layout | S02, S40 |
| D2 | WebSocket: `upgradeWebSocket` + `WebSocketServer({noServer:true})` from `@hono/node-server` + `ws` (the `@hono/node-ws` package is deprecated). | Yes | S29 |
| D3 | Persistence: built-in `node:sqlite` (`DatabaseSync`), plain SQL + a `schema_version` table, no ORM. | Yes | S21 |
| D4 | Markdown render: `markdown-it` with `html:false`, `linkify:false` (quiz files are trusted, student input is never rendered as HTML). | Yes | S50 |
| D5 | i18n: hand-written typed dictionaries in `common/src/i18n/` + a 20-line `t()`; no i18n library. Applies to the **student UI only**. | Yes | S16 |
| D6 | Routing: read `location.pathname` and render `/`, `/admin`, `/display`; no `vue-router`. | Yes | S40 |
| D7 | Timing: server owns phase + `deadlineMs`; after a question expires the server auto-advances (config `autoAdvance`). Pause stores `remainingMs`; resume creates a fresh deadline. | Yes | S24 |
| D8 | Identity: client-generated `crypto.randomUUID()` in `localStorage`; username is unique per quiz session (case-insensitive, 1–24 chars). Conflict → 409 + pick another name. | Yes | S22, S43 |
| D9 | Admin protection: optional `adminKey` in config (sent as `X-Admin-Key`); if unset, admin endpoints are open and a warning is logged. Display + student endpoints are always public. | Yes | S28 |
| D10 | Projector waiting screen shows the join URL from config `publicUrl`; QR code is **not** included (adds a dependency, not required). | Skip QR | S49 |
| D11 | Projector does **not** reveal the correct answer after the timer (teacher reveals verbally). No reveal phase, no grading. | Yes | S50 |
| D12 | Text answers: send on every input, debounced 400 ms; every distinct value is stored as a new history row. | Yes | S47 |
| D13 | CSV export: one row per stored answer **event** (full history) + `--latest` flag for one row per student/question. | Yes | S31 |

---

## Platform notes (grounding for WS + timers)

- **Mobile WebSocket caveat (verified online):** iOS/Safari can silently recycle a backgrounded
  WebSocket — `onclose` may never fire and `readyState` stays `OPEN` (WebKit bugs 228296,
  247943). Mitigations are mandatory, not optional: force-close + reconnect on
  `visibilitychange → visible`, server `ping` every 30 s, client watchdog (~70 s) that resets
  on any frame, reconnect on `online`, exponential backoff with jitter.
- **NAT / proxies:** idle TCP mappings can be dropped in ~30 s on cellular; a reverse proxy must
  forward `Upgrade`/`Connection` headers and must not buffer the WS route.
- **Timing:** never count down by decrementing a client-side integer. Send absolute
  `deadlineMs` + `serverTime`, estimate clock offset from ping RTT, and clamp at 0. Server
  timestamp (`Date.now()` at receipt) is the only authority for accepting answers.
- **No TLS in-process** (reverse proxy terminates it), so the client must derive `ws://` vs
  `wss://` from `location.protocol`.

---

## Target layout (planned additions marked `+`)

```
.agents/{Initial.md, AGENTS.md, TODO.md}
.biome.json  package.json  tsconfig.json  data/ (+ .gitkeep, gitignored)
bin/ + fquiz.ts  fquiz-parse.ts  fquiz-export.ts
common/src/
  index.ts
  quiz/    + types.ts parse.ts validate.ts public.ts   (*.test.ts colocated)
  protocol/ + messages.ts guards.ts
  i18n/    + en.ts ro.ts index.ts
backend/src/
  index.ts                    (bootstrap only: config → db → quiz → engine → app → serve)
  app.ts +                    (createApp(deps): routes, testable without sockets)
  config/  loader.ts types.ts (extended)
  db/      + db.ts schema.ts students.ts answers.ts sessions.ts
  quiz/    + load.ts
  session/ + engine.ts runtime.ts
  http/    + routes.ts middleware.ts
  ws/      + hub.ts
  export/  + csv.ts
frontend/
  index.html main.ts App.vue assets/style.css
  + pages/{StudentPage,AdminPage,DisplayPage}.vue
  + components/…   + lib/{api.ts,ws.ts,storage.ts,i18n.ts,clock.ts}
docs/      + quiz-format.md deployment.md qa.md
scripts/   + optional dev helpers
```

---

## M0 — Hygiene & guardrails (no product behavior)

- [ ] **S01 — Repo hygiene** · deps: none · commit: `chore: add data dir and clean workspace noise`
  - Files: `.gitignore`, `data/.gitkeep`, delete `backend/package-lock.json`
  - Do: ignore `data/`, `*.sqlite`, `*.sqlite-*`, `*.db`, keep `.agents/` tracked; add empty
    `data/.gitkeep`; remove the stray per-workspace lockfile; confirm `config.yaml` policy
    (only `config.sample.yaml` committed).
  - Verify: `git status --short`, `git check-ignore -v data/fquiz.sqlite`.
  - Done when: fresh checkout + `npm install` still works and no build output is tracked.

- [ ] **S02 — Typecheck baseline** · deps: S01 · commit: `build: make typecheck cover every workspace`
  - Files: `frontend/tsconfig.json`, `frontend/package.json`, `common/package.json`,
    `backend/package.json`, `package.json`
  - Do: fix `frontend` `include` per D1 (keep `lib: DOM`), add `vue-tsc --noEmit` as
    `frontend` typecheck (dep: `vue-tsc`), add root `"typecheck": "npm -C common run typecheck
    && npm -C backend run typecheck && npm -C frontend run typecheck"`.
  - Verify: `npm run typecheck` → 0 errors.
  - Done when: `main.ts`, `App.vue` and `vite.config.ts` are actually covered.

- [ ] **S03 — Lint/format gate** · deps: S02 · commit: `chore: make biome check clean`
  - Files: `.biome.json` (only if needed), source files (formatting only)
  - Do: run `npx biome check --write`, resolve the remaining diagnostics without behavior
    changes; add root `"format"` script; make sure `.agents/`, `data/`, `dist/` are ignored.
  - Verify: `npm run check` exits 0.
  - Done when: the only diff is lint/formatting.

- [ ] **S04 — Test harness** · deps: S02 · commit: `test: add node:test + tsx harness`
  - Files: `package.json` (root `test`), `common/package.json`, `backend/package.json`,
    `common/src/smoke.test.ts`
  - Do: run `node --import tsx --test "src/**/*.test.ts"` per workspace; root aggregates. One
    trivial assertion proves the runner works; tests are colocated (`*.test.ts`) but excluded
    from bundles (only entrypoints are bundled).
  - Verify: `npm test` → tests discovered in `common/`.
  - Done when: adding a failing test fails CI/`npm test`.

- [ ] **S05 — Shared package surface** · deps: S04 · commit: `common: prepare shared package entrypoint`
  - Files: `common/package.json`, `common/src/index.ts`
  - Do: keep a single entrypoint `@fquiz/common` (`exports: { ".": "./src/index.ts" }`) and a
    documented placeholder in `src/index.ts`; the actual re-exports land in S17, once the
    modules exist. No subpath exports and no build step for `common`.
  - Verify: `npm run typecheck`; a temporary `import type { } from "@fquiz/common"` resolves in
    backend and frontend (do not commit the temporary import).
  - Done when: backend/frontend can import from common without a build step.

---

## M1 — Common library (pure, no I/O)

- [ ] **S10 — Quiz domain types** · deps: S05 · commit: `common: add quiz domain types`
  - Files: `common/src/quiz/types.ts` (+ test-free)
  - Do: `Quiz { id, title, defaultAnswerTimeSec, instructionsMarkdown, slides }`,
    `Slide = QuestionSlide | InfoSlide`, `QuestionSlide { kind:"question", index, promptMarkdown,
    choices: Choice[], answer: string | null, answerTimeSec, comment?, type: "choice"|"number"|"text" }`,
    `Choice { letter, labelMarkdown }`, `QuizMeta` (public subset). Numeric `index` = position
    among **questions** (stable key for answers), independent of slide position.
  - Verify: `npm -C common run typecheck`.
  - Done when: no `any`, all fields documented, discriminants named `kind`.

- [ ] **S11 — Quiz markdown parser** · deps: S10 · commit: `common: parse quiz markdown`
  - Files: `common/src/quiz/parse.ts`, `parse.test.ts`, `common/package.json` (add `yaml`)
  - Do: pure `parseQuiz(markdown, { source }) → { quiz, issues }`.
    - Quiz frontmatter at file start (`id`, `title`, `answerTime`, optional `instructions`,
      `locale`), sections split on a line that is exactly `---`.
    - Optional per-section frontmatter (e.g. `answerTime`) directly after a separator.
    - First section may be an info slide (instructions) when it has no `ANSWER`/`TYPE`.
    - `INFO` slide = no answer and no `TYPE`; question detection is explicit, never inferred
      from the presence of `A.` lines.
    - Choices: lines matching `^\s*([A-F])[.)]?\s*(.*)$`; empty label ⇒ label = letter
      (color/letter questions). Preserve order, reject duplicates.
    - `ANSWER: B` / `ANSWER=B`, `COMMENT:` (excluded from display, kept for data), `TYPE=number|text`
      (default `choice` when an answer exists), `answerTime` inheritance from quiz frontmatter.
    - Normalize CRLF/BOM, trim, keep markdown bodies verbatim; never render.
  - Verify: `npm test` — tests must cover all four slides of `Initial.md`'s example, inheritance,
    info slides, empty choices, duplicate answers, no frontmatter, bad YAML.
  - Done when: no `fs`/network import, deterministic output, line numbers in issues.

- [ ] **S12 — Quiz validation report** · deps: S11 · commit: `common: validate parsed quizzes`
  - Files: `common/src/quiz/validate.ts`, `validate.test.ts`, exported from `parse.ts`
  - Do: split hard errors vs warnings: `E_*` (no questions, answer not among choices, duplicate
    letter, answerTime ≤ 0 or > 600, unknown TYPE, empty prompt) abort startup; `W_*`
    (empty choice label, missing title, no instructions) only warn. Message includes
    `source:line`.
  - Verify: `npm test` — one case per code.
  - Done when: server can print `path:line: E_ANSWER_UNKNOWN …` and exit non-zero.

- [ ] **S13 — Public quiz projection** · deps: S12 · commit: `common: strip answers and comments for public payloads`
  - Files: `common/src/quiz/public.ts`, `public.test.ts`
  - Do: `toPublicQuiz(quiz)` / `toPublicMeta(quiz)` returning **copies** without `answer`,
    `comment`, and future fields; `toDisplayQuestion(quiz, index)` for the projector (same
    stripping, no info slides after start). Type-level test: the public type has no `answer`
    field, so a leak is a compile error.
  - Verify: `npm test`; grep the public payload for `\"answer\"` in a test assertion.
  - Done when: a single, auditable boundary; nothing else builds public payloads by hand.

- [ ] **S14 — Wire protocol types** · deps: S10 · commit: `common: add client/server protocol types`
  - Files: `common/src/protocol/messages.ts`
  - Do: discriminated unions + `phase = "waiting"|"question"|"paused"|"ended"`:
    - C→S: `join {studentId, username, lang}`, `answer {questionIndex, value, clientTs, clientSeq}`,
      `ping {t}`.
    - S→C: `hello {serverTime, student, state, answers: AnswerRecord[], quiz: PublicQuizMeta}`,
      `state {phase, questionIndex, deadlineMs|null, remainingMs|null, serverTime, counts}`,
      `ack {questionIndex, value, serverTs, clientSeq}`, `error {code, message}`,
      `pong {t, serverTime}`.
    - REST DTOs: `StateResponse`, `JoinResponse`, `AnswerResponse`, `QuizMetaResponse`,
      `AdminStateResponse` (with quiz summary + students), `ApiError {code, message}`.
  - Verify: `npm run typecheck`.
  - Done when: every message has one owner and the same types are used by both ends.

- [ ] **S15 — Runtime message guards** · deps: S14 · commit: `common: validate inbound websocket messages`
  - Files: `common/src/protocol/guards.ts`, `guards.test.ts`
  - Do: hand-written `parseClientMessage(raw: string): ClientMessage | null` with size cap
    (e.g. 2 KB), `studentId`/`clientSeq`/`value` type+length checks, unknown keys tolerated,
    unknown `type` rejected. No validation library.
  - Verify: `npm test` — fuzz-ish cases: `""`, `"{}"`, huge frames, wrong types, extra fields.
  - Done when: the WS handler never trusts unvalidated JSON.

- [ ] **S16 — i18n dictionaries** · deps: S05 · commit: `common: add English and Romanian student strings`
  - Files: `common/src/i18n/{en.ts,ro.ts,index.ts}`, `i18n.test.ts`
  - Do: `type Lang = "en" | "ro"`; `en` is the key source (`typeof en`), `ro: Record<keyof typeof en, string>`
    so a missing translation fails typecheck; `t(lang, key, params?)` with `{name}` interpolation;
    `detectLang(acceptLanguage)`; keys for join/waiting/question/errors/connection states.
  - Verify: `npm test` (key parity + interpolation).
  - Done when: no hardcoded student-facing English remains in components (checked in S54).

- [ ] **S17 — Common barrel + boundaries** · deps: S13, S15, S16 · commit: `common: expose public API barrel`
  - Files: `common/src/index.ts`, `common/src/quiz/index.ts`, `common/src/protocol/index.ts`
  - Do: re-export the intended surface only; no Node APIs in `common` (it is bundled into the
    browser); add a short header comment stating that rule.
  - Verify: `npm run typecheck && npm test`.
  - Done when: `import type { Quiz } from "@fquiz/common"` works in both apps.

---

## M2 — Backend foundations

- [ ] **S20 — Config v2** · deps: S17 · commit: `backend: extend config and add CLI overrides`
  - Files: `backend/src/config/types.ts`, `loader.ts`, `loader.test.ts`,
    `backend/config.sample.yaml`
  - Do: fields `port`, `hostname`, `dataDir`, `dbPath`, `publicUrl`, `adminKey?`,
    `autoAdvance` (default true), `interQuestionDelayMs` (0), `answerTimeDefaultSec` (optional
    fallback), `logLevel`. Resolution order: `--config <file>` → `FQUIZ_CONFIG` → `./config.yaml`
    → `./backend/config.yaml`; resolve relative paths against the config file's directory;
    validate types/ranges and fail with a readable error. `loadConfig({argv, env})` stays pure
    enough to test.
  - Verify: `npm test` — temp-dir tests for every resolution path + invalid YAML + bad ranges.
  - Done when: `npm start` from repo root finds `backend/config.yaml`.

- [ ] **S21 — SQLite bootstrap + migrations** · deps: S20 · commit: `backend: add sqlite database and schema`
  - Files: `backend/src/db/db.ts`, `backend/src/db/schema.ts`, `db.test.ts`
  - Do: `openDb(path)` using `node:sqlite` `DatabaseSync`; create `dataDir` if missing;
    `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`; `schema_version` table +
    numbered migrations applied in a transaction. Schema:
    `students(id TEXT PK, username TEXT NOT NULL, username_norm TEXT NOT NULL UNIQUE, lang TEXT
    NOT NULL DEFAULT 'en', created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)`,
    `sessions(id TEXT PK, quiz_id TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER)`,
    `answers(id INTEGER PK AUTOINCREMENT, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
    quiz_id TEXT NOT NULL, question_index INTEGER NOT NULL, type TEXT NOT NULL, value TEXT NOT
    NULL, client_ts INTEGER, server_ts INTEGER NOT NULL, client_seq TEXT)`,
    index `(session_id, student_id, question_index)`, `session_state(session_id TEXT PK,
    state_json TEXT NOT NULL, updated_at INTEGER NOT NULL)`.
  - Verify: `npm test` — create in temp dir, reopen, version is idempotent, unique username.
  - Done when: no hand-editing of DB files; deleting `data/` recreates everything.

- [ ] **S22 — Repositories** · deps: S21 · commit: `backend: add student, session and answer repositories`
  - Files: `backend/src/db/{students,answers,sessions}.ts` + tests
  - Do: typed functions, prepared statements reused, all timestamps in **server epoch ms**;
    `upsertStudent` / `findStudent` / `listStudents`, `insertAnswer` (append-only),
    `listAnswers(studentId, sessionId)` (ordered), `latestAnswers(...)`,
    `createSession/loadSessionState/saveSessionState/endSession`.
    Username uniqueness throws a typed `NameTakenError`.
  - Verify: `npm test` — append history preserved, ordering by `server_ts,id`, name conflict.
  - Done when: no SQL outside `backend/src/db/`.

- [ ] **S23 — Quiz loading + meta endpoint** · deps: S12, S20, S22 · commit: `backend: load quiz file at startup`
  - Files: `backend/src/quiz/load.ts` + test, `backend/src/app.ts` (seed)
  - Do: `loadQuiz(path)` reads UTF-8, calls `parseQuiz`, prints errors as `file:line: CODE msg`,
    throws on hard errors; `GET /api/quiz/meta` returns `toPublicMeta` + question count +
    answer times. Server refuses to start with an invalid quiz (non-zero exit).
  - Verify: `npm test` (valid + invalid fixture), `curl localhost:8080/api/quiz/meta | jq`.
  - Done when: the meta payload contains no answer/comment strings.

- [ ] **S24 — Session engine (pure)** · deps: S14, S23 · commit: `backend: add quiz session state machine`
  - Files: `backend/src/session/engine.ts`, `engine.test.ts`
  - Do: pure reducer with injected clock: `EngineState {phase, questionIndex, deadlineMs,
    remainingMs, sessionId, answersOpen}` and commands `start`, `pause`, `resume`, `end`,
    `reset`, `tick`. Rules: start → first question with `deadline = now + answerTime`; expiry →
    next question after `interQuestionDelayMs` (or `ended`); pause freezes `remainingMs`;
    resume restarts the deadline from the remaining time; answers open only in `question` and
    `now <= deadlineMs`; `reset` → `waiting`, index 0, new session id. Emits a `StateEvent` on
    every transition.
  - Verify: `npm test` — table-driven: start, expiry, auto-advance, last question → ended,
    pause/resume remaining time, reset, answer gate boundaries (`deadlineMs-1`, `deadlineMs`).
  - Done when: zero timers/IO in this file.

- [ ] **S25 — Engine runtime (timers + persistence)** · deps: S24 · commit: `backend: drive session engine with timers`
  - Files: `backend/src/session/runtime.ts`, `runtime.test.ts`
  - Do: wraps the reducer; one `setTimeout` re-armed per transition (never a 1 s poll loop);
    on transition persist `session_state` and notify subscribers; on boot restore state (if a
    restored question deadline already passed, advance); `stop()` clears timers.
  - Verify: `npm test` with `node:test` mock timers (advance time, assert transitions and DB
    writes); server restart mid-question restores.
  - Done when: timers are `unref()`-friendly and no listener leaks on reset/end.

- [ ] **S26 — App factory + REST routes** · deps: S22, S23, S25 · commit: `backend: add health, join, state and answer routes`
  - Files: `backend/src/app.ts`, `backend/src/http/routes.ts`, `http/middleware.ts` + tests
  - Do: `createApp(deps)` (Hono) so tests use `app.request`; routes:
    `GET /api/health`, `GET /api/quiz/meta`, `GET /api/state`, `POST /api/join`,
    `GET /api/answers/mine?studentId=`, `POST /api/answers`, admin actions
    `POST /api/admin/{start,pause,resume,end,reset}`, `GET /api/admin/state`
    (joined students, counts, resolved quiz path, db path, uptime). Uniform error envelope
    `{ error: { code, message } }`; JSON body size limit; no stack traces in responses.
  - Verify: `npm test` — happy paths + 400/404/409 (name taken, late answer) via
    `app.request`; `curl` matrix in the step notes.
  - Done when: no business logic inside route handlers (thin adapters only).

- [ ] **S27 — Answer ingestion rules** · deps: S26 · commit: `backend: accept and dedupe student answers`
  - Files: `backend/src/http/routes.ts`, `backend/src/session/runtime.ts`, `answers.test.ts`
  - Do: validate against the current question index and type (`choice` letter must exist,
    `number` numeric, `text` ≤ 500 chars); reject when phase ≠ `question` or after
    `deadlineMs` with `E_CLOSED`; store **every** accepted change with server ts (append-only);
    dedupe identical `(student, question, value, clientSeq)` retransmits; return
    `{accepted, serverTs, reason?}`. Update `last_seen_at`.
  - Verify: `npm test` — late click, repeated click, changed answer, retransmit, wrong type,
    after-end submission.
  - Done when: replaying the same request never duplicates a row.

- [ ] **S28 — Admin guard** · deps: S26 · commit: `backend: guard admin routes with optional key`
  - Files: `backend/src/http/middleware.ts`, `routes.ts`, tests
  - Do: per D9; timing-safe comparison (`crypto.timingSafeEqual`), 401 envelope, warn once at
    startup when unset. Student/display routes stay public.
  - Verify: `npm test` — no key set, correct key, wrong key, header missing.
  - Done when: the display page needs no secret.

- [ ] **S29 — WebSocket hub** · deps: S15, S26, S27 · commit: `backend: add websocket hub for realtime sync`
  - Files: `backend/src/ws/hub.ts`, `hub.test.ts`, `backend/src/index.ts`, `backend/package.json`
  - Do: per D2 — `upgradeWebSocket` from `@hono/node-server`, `new WebSocketServer({noServer:true})`
    passed to `serve({fetch, websocket})`; `/ws` route. Hub responsibilities: registry
    `connId → {ws, studentId?, role: "student"|"display"}` (display joins read-only via
    `?role=display`), `join` handshake → `hello` with state + own answers, broadcast `state` on
    every engine transition, `ack`/`error` to the sender, server `ping` every 30 s and
    terminate dead sockets, per-connection rate limit (e.g. 30 msg/s) and 2 KB frame cap.
    Never broadcast answers or comments.
  - Verify: `npm test` — hub logic with fake sockets (no real ports); `npm run dev` + `wscat`
    or `node --input-type=module -e` client for a manual smoke test.
  - Done when: a second student joins and sees the current phase immediately.

- [ ] **S30 — SPA + static serving** · deps: S26 · commit: `backend: serve frontend with SPA fallback`
  - Files: `backend/src/app.ts`
  - Do: static assets from `dist/public` with long cache; fallback to `index.html` for `/`,
    `/admin`, `/display` (unknown non-API GETs → index too, `/api/*` → JSON 404); `index.html`
    `no-cache`; do not shadow `/ws`; keep `/api` outside the static handler.
  - Verify: `curl -i /admin` → 200 HTML; `curl -i /api/nope` → 404 JSON; deep refresh works.
  - Done when: hard refresh on every route works in production build.

- [ ] **S31 — CSV export** · deps: S22 · commit: `bin: add csv answer export`
  - Files: `backend/src/export/csv.ts` + test, `bin/fquiz-export.ts`
  - Do: per D13. Columns: `quiz_id,session_id,student_id,username,question_index,type,value,
    attempt,client_ts_ms,server_ts_ms,server_ts_iso`. RFC 4180 quoting (quotes, commas, newlines),
    UTF-8 BOM optional (`--bom`), `--latest`, `--session`, `--db`, `--out`. Writes to stdout by
    default; DB opened read-only.
  - Verify: `npm test` — golden CSV for values containing `,`, `"`, `\n`; `npm run export -- --help`.
  - Done when: a spreadsheet opens the output unchanged and history is complete.

- [ ] **S32 — Quiz parse CLI** · deps: S12 · commit: `bin: add quiz markdown parser cli`
  - Files: `bin/fquiz-parse.ts`, `bin/fquiz-parse.test.ts` (function-level)
  - Do: `fquiz-parse <quiz.md> [--json|--pretty|--out file]`, exit `2` on parse errors, print
    issues to stderr with `file:line`, no answers on stdout unless `--with-answers`.
  - Verify: run against all example slides; invalid file exits 2.
  - Done when: the CLI is a thin wrapper (all logic in common/backend).

- [ ] **S33 — Server CLI + build wiring** · deps: S20, S23, S29 · commit: `bin: add server entrypoint and bundle cli tools`
  - Files: `bin/fquiz.ts`, `bin/{fquiz,fquiz-parse,fquiz-export}*`, `package.json` scripts,
    `backend/package.json` (esbuild entries)
  - Do: `fquiz --quiz <file.md> [--config <file>] [--port N] [--host H]`; `--help`/`--version`;
    resolve `quizFile` from CLI, then config; friendly startup summary (quiz id, questions,
    db path, listen URL, `publicUrl`, admin key state). Bundles: `node dist/bin/fquiz.js` style,
    or direct `tsx bin/*.ts` in dev. Root scripts `quiz:parse`, `export`, `start`.
  - Verify: `npm run build && node dist/bin/fquiz.js --quiz <fixture> --port 0` (prints the
    chosen port); `npm start` unchanged for the sample quiz.
  - Done when: `bin/` needs no `node_modules` beyond bundled deps.

- [ ] **S34 — Graceful shutdown** · deps: S29, S33 · commit: `backend: shut down cleanly on signals`
  - Files: `backend/src/index.ts`, `bin/fquiz.ts`
  - Do: on `SIGINT`/`SIGTERM`: stop accepting HTTP, close WS with code 1001, clear engine timers,
    persist state, `db.close()`, exit 0; 5 s force-exit guard; log shutdown phases.
  - Verify: Ctrl-C during a live question; restart restores phase/deadline; no unhandled rejections.
  - Done when: `docker stop` in S62 is clean.

---

## M3 — Frontend (student → display → admin)

- [ ] **S40 — Frontend skeleton & routing** · deps: S02, S17, D1/D6 · commit: `frontend: add page layout and pathname routing`
  - Files: `frontend/App.vue`, `frontend/pages/*.vue`, `frontend/lib/*`, `frontend/tsconfig.json`
  - Do: `App.vue` picks `StudentPage` (`/`), `AdminPage` (`/admin`), `DisplayPage` (`/display`)
    from `location.pathname` at mount (plus a 404 fallback); add `lang` attr, viewport already
    fine; Tailwind tokens (`bg`, `fg`, `muted`, `accent`, `success`, `danger`, answer colors) in
    `assets/style.css`; placeholder content per page.
  - Verify: `npm run dev`, open all three paths, `npm run typecheck`.
  - Done when: no page imports another page directly.

- [ ] **S41 — API client** · deps: S14, S40 · commit: `frontend: add typed api client`
  - Files: `frontend/lib/api.ts`, `frontend/lib/errors.ts`
  - Do: `request<T>()` with JSON, timeout via `AbortSignal` (5 s), typed errors carrying
    `code`/`message`/`status`; functions `getState`, `getQuizMeta`, `join`, `getMyAnswers`,
    `submitAnswer`, `adminAction`, `getAdminState`; admin key from `sessionStorage` (never in URL).
  - Verify: `npm run typecheck`; manual 401/409 handling.
  - Done when: every request body/response matches the common protocol types.

- [ ] **S42 — UI primitives** · deps: S40 · commit: `frontend: add shared ui primitives`
  - Files: `frontend/components/{AppButton,Card,StatusBadge,Countdown,ChoiceButton}.vue`
  - Do: minimal, no shadows/gradients; ≥44 px touch targets; `disabled`/pending states;
    A–F colors distinguishable without relying on hue alone (letter + shape/border); number
    formatting `ceil(ms/1000)` in `Countdown`; ARIA where obvious (`role="timer"`,
    `aria-live="polite"` for phase changes).
  - Verify: manual at 360 px and 1440 px; keyboard Tab/Enter; `npm run typecheck`.
  - Done when: no component-specific colors leak into pages.

- [ ] **S43 — Student join flow** · deps: S41, S42 · commit: `frontend: add student join screen`
  - Files: `frontend/pages/StudentPage.vue`, `frontend/lib/storage.ts`
  - Do: username (1–24, trimmed), language select (EN/RO, default from `navigator.language`,
    persisted), persisted `fquiz.studentId` (`crypto.randomUUID`), `fquiz.username`, `fquiz.lang`;
    on submit `POST /api/join`, handle 409 by asking for another name; show quiz title after join.
  - Verify: refresh keeps the name; duplicate name in a second tab is rejected politely.
  - Done when: no username is sent anywhere before the user submits.

- [ ] **S44 — WS client with mobile resilience** · deps: S41 · commit: `frontend: add reconnecting websocket client`
  - Files: `frontend/lib/ws.ts`, `frontend/lib/ws.test.ts` (pure parts), `frontend/lib/clock.ts`
  - Do: build `ws://`/`wss://` from `location`; reconnect with exponential backoff (0.5 s → 8 s,
    jitter, reset on success); force-reconnect on `visibilitychange → visible` by nulling handlers,
    closing, and opening a fresh socket (iOS zombie sockets); reconnect on `online`; watchdog
    timer (~70 s) reset by any inbound frame; send `ping` on open and every 25 s; expose
    `status: "connecting"|"open"|"reconnecting"|"closed"`, typed `send()` (queued while
    connecting, dropped when closed with an event), and clock offset = `serverTime - (t0+t1)/2`
    from `pong`.
  - Verify: `npm test` (backoff + offset math); manual DevTools offline → online; tab
    background → foreground; `npm run build` (no top-level `window` in shared modules).
  - Done when: the UI never shows stale data after foregrounding.

- [ ] **S45 — Student session store** · deps: S41, S44 · commit: `frontend: add student session store`
  - Files: `frontend/lib/session.ts`, `frontend/lib/session.test.ts`
  - Do: a small reactive store (no Pinia): `phase`, `questionIndex`, `deadline`, `answers` map,
    `pending` map, `connection`, `errors`; reducers `applyHello`, `applyState`, `applyAck`,
    `optimisticAnswer`, `revertPending`; compute "serverNow = Date.now() + offset"; on `hello`
    replace local answers with server truth (restore after refresh/background); re-`join` after
    every reconnect.
  - Verify: `npm test` — reducer cases: reconnect replay, ack matching by `clientSeq`,
    clock-offset countdown, ended state clears inputs.
  - Done when: the store is the only place that mutates student state.

- [ ] **S46 — Student waiting screen** · deps: S42, S45 · commit: `frontend: add student waiting screen`
  - Files: `frontend/pages/StudentPage.vue`, `frontend/components/ConnectionBadge.vue`
  - Do: "you're in" card with username, quiz title, short instructions from `quiz.instructions`
    (localized defaults if empty), waiting spinner-free text, offline/reconnecting banner;
    language toggle stays available.
  - Verify: state `waiting` → correct copy in both languages; kill server → banner appears.
  - Done when: nothing from the quiz file leaks (no question text) in `waiting`.

- [ ] **S47 — Student answering UI** · deps: S45, S46, D12 · commit: `frontend: add student question inputs`
  - Files: `frontend/pages/StudentPage.vue`, `frontend/components/{ChoiceButton,NumberPad?}.vue`
  - Do: `choice` → A–F grid of unlabeled buttons (letter only) sized for thumbs; `number` →
    numeric input (`inputmode="numeric"`, pattern) with a "send" affordance only if needed;
    `text` → single-line input, debounced 400 ms, `Enter` flushes; every change sends over WS
    with `clientSeq` (+ HTTP fallback if WS not open); optimistic highlight + "saved" tick;
    disable all input when the local deadline passed or phase ≠ `question`; no answer
    revealed on screen; handle `E_CLOSED` by locking and showing a neutral message.
  - Verify: manual on a phone-sized viewport: tap latency < 100 ms locally, answer survives
    refresh, late tap rejected.
  - Done when: rapid taps produce ordered, deduped rows in the DB.

- [ ] **S48 — Student error/edge states** · deps: S47 · commit: `frontend: handle student session edge cases`
  - Files: `frontend/pages/StudentPage.vue`, `frontend/lib/session.ts`
  - Do: server `ended` → thank-you screen; `reset` → back to waiting with identity kept;
    name conflict after reset → prompt; banned/duplicate-tab info; `error` envelopes surfaced
    as short, localized messages; retry button for a failed `join`.
  - Verify: manual matrix (ended, reset, server restart, duplicate name).
  - Done when: no state shows a blank screen.

- [ ] **S49 — Display waiting screen** · deps: S41, S42, S44 · commit: `frontend: add projector waiting screen`
  - Files: `frontend/pages/DisplayPage.vue`
  - Do: quiz title, instructions markdown (rendered in S50), join URL from `/api/state` or
    `/api/quiz/meta` (`publicUrl` fallback `location.origin`), joined count, "waiting for the
    teacher" line, auto-reconnect; large type scaled with viewport (`clamp()`).
  - Verify: refresh at 1920×1080 and 1280×720; joined count updates live.
  - Done when: no answers/comments appear in the page source (fetch payload).

- [ ] **S50 — Display question screen** · deps: S49, D4, D11 · commit: `frontend: render synchronized questions on the projector`
  - Files: `frontend/pages/DisplayPage.vue`, `frontend/components/MarkdownView.vue`,
    `frontend/package.json` (`markdown-it`)
  - Do: render only `promptMarkdown` + choice labels via `markdown-it` (`html:false`,
    `linkify:false`, `breaks:false`), sanitize by construction (no `v-html` outside
    `MarkdownView`, which is the only `v-html` in the codebase); big countdown derived from
    `deadlineMs` + clock offset, turns neutral (not alarming) at ≤ 5 s; question index/total;
    fade-free, layout-stable; paused overlay with remaining time frozen; ended screen with a
    short summary (no per-student data).
  - Verify: two clients (display + student) show the same second; pause freezes both; reload
    mid-question restores; XSS attempt in markdown (`<img onerror>`) renders as text.
  - Done when: `grep -r "v-html" frontend` returns exactly one file.

- [ ] **S51 — Display connection/diagnostics footer** · deps: S50 · commit: `frontend: show projector connection state`
  - Files: `frontend/pages/DisplayPage.vue`, `frontend/components/ConnectionBadge.vue`
  - Do: small unobtrusive status line (connected/reconnecting, server time skew, current
    quiz id), hidden when healthy, so a broken projector link is obvious without console access.
  - Verify: offline/online toggle; skew display sanity.
  - Done when: the teacher can diagnose a frozen screen at a glance.

- [ ] **S52 — Admin control page** · deps: S26, S41, S42 · commit: `frontend: add admin control panel`
  - Files: `frontend/pages/AdminPage.vue`, `frontend/components/{AdminControls,StudentList}.vue`
  - Do: quiz summary (id, title, question count, answer times); buttons Start / Pause / Resume /
    Next (only if enabled later) / End / Reset with confirmations for destructive ones; live
    phase badge + current question index; compact joined-student list (name, lang, connected,
    last seen) — **no editing**; admin key prompt stored in `sessionStorage` when configured.
  - Verify: each button changes phase within one round-trip; wrong key shows 401 message;
    accidental double-click cannot double-start.
  - Done when: the admin page never displays question answers or comments.

- [ ] **S53 — Admin diagnostics** · deps: S52, S29 · commit: `frontend: add admin diagnostics panel`
  - Files: `frontend/pages/AdminPage.vue`
  - Do: read-only facts: resolved quiz path, db path, quiz id, connected WS count, joined count,
    server uptime/clock, last 10 server-side rejections (in-memory), and per-question answer
    counts (no values shown, to preserve the "no grading" rule). Copy-to-clipboard for support.
  - Verify: counts change live; no values leak.
  - Done when: a class can be debugged from the admin page alone.

- [ ] **S54 — i18n completeness** · deps: S16, S48 · commit: `frontend: localize all student strings`
  - Files: `frontend/pages/StudentPage.vue`, `frontend/components/*.vue`, `frontend/lib/i18n.ts`
  - Do: replace every literal in the student path; `t()` with reactive `lang`; language switch
    persists and updates `<html lang>`; keep projector/admin English (documented).
  - Verify: `grep` for known English phrases in the student path; manual RO pass.
  - Done when: switching to RO leaves no English (except the quiz's own text).

- [ ] **S55 — Accessibility & responsive pass** · deps: S54 · commit: `frontend: improve a11y and small-screen layout`
  - Files: frontend components/pages + `assets/style.css`
  - Do: focus-visible rings, label associations, `aria-live` for phase changes, 200 % zoom,
    360×640, landscape phone, 1440p projector; respect `prefers-reduced-motion`; contrast check;
    make sure the countdown is not the only signal (text also says "answers closed").
  - Verify: keyboard-only run through join → answer; DevTools a11y audit has no critical issues.
  - Done when: a student can finish a quiz without a mouse and without color perception.

---

## M4 — Build, packaging, docs, end-to-end

- [ ] **S60 — Dev proxy & build check** · deps: S30, S50 · commit: `build: proxy api and websocket in vite dev`
  - Files: `frontend/vite.config.ts`, `frontend/index.html`
  - Do: proxy `/api` and `/ws` (`ws: true`) to the backend port from an env var
    (`FQUIZ_BACKEND_PORT`, default 3000); verify `vite build` output is served by the backend;
    keep `emptyOutDir`.
  - Verify: `npm run dev` (both) → join from a phone on the LAN; `npm run build && npm start` →
    same flow on one origin.
  - Done when: one command pair works in dev and prod.

- [ ] **S61 — Root scripts & clean-install check** · deps: S33, S60 · commit: `build: finalize workspace scripts`
  - Files: `package.json` (+ workspace ones)
  - Do: `dev`, `build`, `start`, `typecheck`, `test`, `check`, `format`, `quiz:parse`, `export`,
    `clean`; document `npm ci`; verify `engines`; drop unused deps; ensure `npm ci` from a clean
    checkout then `npm run build && npm test` passes.
  - Verify: the commands above from a fresh clone (or `rm -rf node_modules && npm ci`).
  - Done when: a new contributor needs exactly one install command.

- [ ] **S62 — Production container** · deps: S34, S61 · commit: `build: add production image and compose sample`
  - Files: `Dockerfile`, `.dockerignore`, `docker-compose.sample.yml`
  - Do: multi-stage (deps → build → runtime `node:24-trixie-slim`), non-root `node` user,
    `NODE_ENV=production`, `HEALTHCHECK` on `/api/health`, `VOLUME /data`, `dataDir: /data`,
    `publicUrl` via env/config, read-only quiz mount (`/quiz:ro`), entrypoint `node dist/bin/fquiz.js`.
  - Verify: `docker build`, `docker run -v ./data:/data -v ./quiz:/quiz:ro`, quiz completes,
    `docker stop` is clean, DB row count matches answers.
  - Done when: the image runs without the source tree.

- [ ] **S63 — Devcontainer refresh** · deps: S61 · commit: `devcontainer: align ports and tooling`
  - Files: `.devcontainer/*`
  - Do: forward 3000 + 5173, remove Prettier/ESLint extensions (repo uses Biome), add Biome
    extension, `postCreateCommand: npm ci`, optional sqlite CLI for debugging.
  - Verify: rebuild container; `npm run dev` reachable from the host; `npm test` passes inside.
  - Done when: the agent container matches the documented workflow.

- [ ] **S64 — Docs** · deps: S31, S54, S62 · commit: `docs: add usage, quiz format and deployment guides`
  - Files: `README.md`, `docs/quiz-format.md`, `docs/deployment.md`, `.agents/AGENTS.md` (sync)
  - Do: quick start, quiz authoring (all constructs + edge cases from S11), config reference,
    CLI reference, reverse-proxy example (nginx `Upgrade`/`Connection`, no buffering on `/ws`,
    client_max_body_size), backup of `data/`, CSV import into a spreadsheet, i18n notes,
    "no TLS in-process" rationale.
  - Verify: follow the README on a clean machine/container without extra knowledge.
  - Done when: docs and code agree (commands copy-pasteable).

- [ ] **S65 — QA checklist** · deps: S62, S63 · commit: `docs: add end-to-end qa checklist`
  - Files: `docs/qa.md`
  - Do: scripted manual matrix: 3 students + display + admin; refresh mid-question; phone lock
    during a question (answer after unlock rejected, state recovers); Wi-Fi→cellular switch;
    pause/resume; end/reset/restart server mid-quiz; duplicate username; late tap; CSV export
    with commas/quotes/newlines; projector reload; 50 real WS connections (load sanity).
  - Verify: run it once, record pass/fail and timings (answer→ack p95 < 300 ms on LAN).
  - Done when: every line has a recorded result.

- [ ] **S66 — Integration test (spawned server)** · deps: S29, S33, S62 · commit: `test: add end-to-end server flow test`
  - Files: `test/e2e.test.ts` (root), root `test:e2e` script
  - Do: start the built server on an ephemeral port with a temp DB + fixture quiz, drive
    `join → start → answer → expire → export` over HTTP + a `ws` client; assert DB rows and
    state transitions; kill the process in `after()`.
  - Verify: `npm run test:e2e` twice in a row (isolated temp DBs).
  - Done when: CI does not need Docker or a real phone.

- [ ] **S67 — Final audit** · deps: all · commit: `chore: final cleanup and audit`
  - Files: whole repo
  - Do: `npm run typecheck && npm test && npm run check && npm run build`; remove dead code,
    unused deps, stale TODOs; confirm `.agents/TODO.md` is fully ticked; re-read `Initial.md`
    requirements checklist and note anything intentionally deferred.
  - Verify: the four commands above; `git status` clean after build.
  - Done when: no known defect, no unowned feature flag, no uncommitted build artifact.

---

## Dependency graph (critical path)

```
S01 → S02 → S03
        └→ S04 → S05 → S10 → S11 → S12 → S13 → S17
                        └→ S14 → S15 ───────┘
                        └→ S16 ─────────────┘
S17 → S20 → S21 → S22 → S23 → S24 → S25 → S26 → S27 → S29 → S33 → S34
                                     S26 → S28
                                     S26 → S30
                          S22 → S31
                          S12 → S32
S17 → S40 → S41 → S42 → S43 → S44 → S45 → S46 → S47 → S48 → S54 → S55
              S41 → S49 → S50 → S51
              S41 → S52 → S53
S30,S50 → S60 → S61 → S62 → S63 → S65
S31,S54,S62 → S64
S29,S33,S62 → S66
all → S67
```

Parallelisable once `S17` lands: backend track (`S20…S34`) and frontend shell
(`S40…S42`) are independent. `S45+` needs live backend routes, so land `S26` first.

## Testing strategy (kept deliberately small)

| Layer | Tool | What must be covered |
|-------|------|----------------------|
| `common` | `node:test` + `tsx`, colocated `*.test.ts` | parser, validator, public projection, guards, i18n parity |
| `backend` | same, plus temp-dir SQLite | config resolution, migrations, repositories, engine (table-driven), routes via `app.request`, CSV golden files |
| `frontend` | same for pure logic only | backoff/clock math, session store reducers |
| e2e | root `test/e2e.test.ts`, `ws` client | join → start → answer → expire → export |

Rules: tests must not depend on wall-clock sleeps (use mocked timers), must not bind fixed ports,
must create their own temp DB (`mkdtemp`) and delete it. No coverage thresholds; every parser and
engine branch is more valuable than a percentage.

## Intentionally deferred (do not build without a new decision)

- Web-based quiz editor / CRUD, user accounts, OAuth, grading logic, scoreboards.
- Team modes, multiple simultaneous quizzes, multi-class scheduling.
- TLS in-process, Redis, message queues, ORMs, Docker Swarm/K8s manifests.
- Native apps, PWA install/offline quiz play (offline *restore* is covered by S48).
- Answer reveal phase on the projector (D11) and QR code (D10).
