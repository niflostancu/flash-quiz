# fquiz dev container — Debian 13 (trixie) base, Node 24.
# No native build deps are required: SQLite is the built-in `node:sqlite`,
# and the backend is bundled with esbuild (no better-sqlite3).
FROM mcr.microsoft.com/devcontainers/javascript-node:24-trixie

# git + ca-certificates for workspace/git-aware tooling (idempotent with base image).
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*
