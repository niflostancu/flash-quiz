# Flash Quiz Web App (FQuiz)

A Kahoot-style, teacher-driven quiz for university classrooms. The goal is to check
attendance and attention in class: questions appear for a fixed number of seconds, and
answers are only accepted while the question is live.

> **Status:** early scaffold. The architecture and step-by-step plan live in
> [`.agents/TODO.md`](./.agents/TODO.md); requirements are in
> [`.agents/Initial.md`](./.agents/Initial.md). Today the repo contains the workspace setup,
> a Hono server, a Vue/Vite/Tailwind sample page and a config loader.

## How it works

Three surfaces served from the same origin:

| Path | Who | What |
|------|-----|------|
| `/` | students (phone) | enter a username, wait, then tap a letter button or type a text/number answer |
| `/display` | projector | waiting screen with the join URL, then the current question with a countdown |
| `/admin` | teacher | start / pause / resume / end / reset, joined-student list, diagnostics |

The server is the source of truth for the quiz phase, the current question and the answer
deadline. Clients compute the countdown locally and sync over WebSocket; a refresh or a
phone lock must never lose a student's submitted answers.
Answers are stored in SQLite and exported to CSV for a separate grader (at least this is 
the plan for now).

## Technologies Used

- **[TypeScript](https://www.typescriptlang.org/)** everywhere (strict, ESM, [Node.js](https://nodejs.org/) ≥ 24)
- **Backend:** [Hono](https://hono.dev/) + [`@hono/node-server`](https://github.com/honojs/node-server), bundled with [esbuild](https://esbuild.github.io/)
- **Frontend:** [Vue 3](https://vuejs.org/) + [Vite](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **Shared:** `common/` — quiz parser, wire protocol, i18n (no Node APIs)
- **Storage:** built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html), answers are append-only
  with server timestamps
- **Realtime:** [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
  ([`ws`](https://github.com/websockets/ws) + Hono's
  [`upgradeWebSocket`](https://hono.dev/docs/helpers/websocket))
- **Tooling:** [Biome](https://biomejs.dev/) (lint/format),
  [`node:test`](https://nodejs.org/api/test.html) + [tsx](https://tsx.is/),
  [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)

## Layout

```
common/     shared TS: quiz types + markdown parser, protocol, i18n etc.
backend/    config, SQLite, session engine, HTTP API, WebSocket hub, CSV export
frontend/   Vue pages/components, API + WS clients, Tailwind styles
bin/        CLI tools: server, quiz parser, CSV export (planned)
data/       runtime SQLite files (gitignored, configurable)
.agents/    requirements, development plan, agent workflow
```

## Quick start

```bash
npm ci
cp backend/config.sample.yaml backend/config.yaml   # optional, defaults are fine
npm run dev                                         # backend :3000 + Vite :5173
```

Open <http://localhost:5173>. Build and run the production bundle on one origin:

```bash
npm run build    # Vite → backend/dist/public, then esbuild the server
npm start        # http://localhost:3000
```

The intended production invocation is:

```bash
fquiz --quiz path/to/quiz.md [--config config.yaml] [--port 3000]
```

(TLS is intentionally not handled here - you must put it behind a reverse proxy that also
forwards the WebSocket proto correctly)

## Quiz format

A quiz is a Markdown file: optional [YAML](https://yaml.org/) frontmatter, sections separated
by `---`, and [Aiken-style](https://docs.moodle.org/en/Aiken_format) answers.

```markdown
---
id: 02_crypto_quiz
title: "Cryptography Flash Quiz"
answerTime: 15
---

Which one is a modern, secure **stream cipher**?

A. RC4
B. TwoFish
C. AES
D. ChaCha20-Poly1305

ANSWER=D

---
answerTime: 6
---
What is the number of bits of an AES block?

TYPE=number
```

A section with no `ANSWER`/`TYPE` is an info slide (instructions). Per-section `answerTime`
overrides the quiz default. Full grammar, edge cases and validation codes: `docs/quiz-format.md`
(TODO).

## Configuration

`config.yaml` (YAML, not committed) — see `backend/config.sample.yaml`:

```yaml
port: 3000
hostname: 0.0.0.0
```

Future versions may add database / quiz and other settings.
Resolution order: `--config` → `FQUIZ_CONFIG` → `./config.yaml` → `./backend/config.yaml`.

## Development workflow

During development, I used Deepseek Flash 4.1 + Qwen 3.8 27B for assistance only.
All changes are manually inspected and optionally modified to my liking / style.

Agent rules and technical decisions are documented in
[`.agents/AGENTS.md`](./.agents/AGENTS.md).

## Notes

- Students are identified by a browser-generated ID stored in `localStorage`; usernames are
  unique per quiz session.
- Answers are kept as full history (every change, every attempt) for analysis / anti-fraud etc.
- Internationalization is EN/RO for the student UI only.
