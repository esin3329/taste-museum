# Persistent Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a phone upload photos to the Ubuntu mini PC and keep collection metadata and files after reloads and server restarts.

**Architecture:** A small Node.js HTTP server serves `dist/client` and exposes `/api/items`, `/api/upload`, and `/api/health`. SQLite stores item metadata; uploaded originals and generated thumbnails are stored outside the repository under a configurable data directory. The React prototype loads persisted items on startup and submits `multipart/form-data` uploads with progress/error feedback.

**Tech Stack:** Node.js 24 built-in `node:sqlite`, Node `http`/`fs`, Vite/React, browser `FormData` and `fetch`.

**Spec:** Approved conversation design: phone upload → mini-PC persistence → gallery/inbox placement; no login; Tailscale access; original files and thumbnails stored on the mini PC.

## Global Constraints

- Keep the existing mobile runtime files protected by `AGENTS.md` unchanged.
- Keep the existing four-room visual design and no-login single-user scope.
- Store runtime data outside the repository and never commit `server/data` or uploaded media.
- Accept images only through the upload endpoint; cap each request at 25 MiB.
- Validate filenames and MIME types server-side; never use a client-supplied path.
- Serve only `dist/client` and the API; do not expose SQLite or the data directory as static files.
- Verify with `npm run check:runtime`, `npm run build`, `npm run test:server`, and `npm run test:sites`.

---

### Task 1: Add failing persistence API tests

**Files:**
- Create: `tests/server.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Tests start `createServer({ dataDir, clientDir })` on an ephemeral port and close it after each test.
- API response shape: `GET /api/items` returns `{ items: Item[] }`; `POST /api/items` accepts JSON metadata; `POST /api/upload` accepts multipart image data and returns `{ item: Item }`.

- [x] **Step 1: Write tests for an empty database, JSON item persistence, and photo upload.** Assert a second server instance reading the same temporary data directory can retrieve the item and the uploaded file is not served from `/museum`.
- [x] **Step 2: Run `npm run test:server` and confirm it fails because the server module and script do not exist.**

### Task 2: Implement SQLite metadata and HTTP server

**Files:**
- Create: `server/db.mjs`
- Create: `server/index.mjs`
- Modify: `.gitignore`, `package.json`

**Interfaces:**
- `openDatabase(dataDir)` creates `museum.sqlite`, enables WAL mode, creates `items` and `rooms` tables, and returns CRUD helpers.
- `createServer({ dataDir, clientDir, port })` returns an `http.Server` with `.close()` and serves the API plus the built client.

- [x] **Step 1: Implement DB initialization and item CRUD with parameterized SQL.**
- [x] **Step 2: Implement static fallback routing and JSON API responses.**
- [x] **Step 3: Implement multipart parsing with a 25 MiB limit, generated UUID filenames, and `dataDir/uploads` storage.**
- [x] **Step 4: Run `npm run test:server` and confirm all tests pass.**

### Task 3: Connect the React screens to the API

**Files:**
- Modify: `src/Prototype.tsx`
- Modify: `src/prototype.css`

**Interfaces:**
- On mount, the museum context loads `/api/items` and replaces demo-plus-persisted state.
- `Add` submits selected photos to `/api/upload`; text and link items submit JSON to `/api/items`.
- Save controls expose `업로드 중`, `저장 실패 · 다시 시도`, and success states without losing form values.

- [x] **Step 1: Add typed API helpers and loading/error context state.**
- [x] **Step 2: Replace object URLs with upload responses and preserve demo assets.**
- [x] **Step 3: Make placement call `PATCH /api/items/:id` and keep the gallery view after success.**
- [x] **Step 4: Run `npm run build` and manually exercise phone photo selection, save, inbox placement, and reload.**

### Task 4: Add Ubuntu installation and operations documentation

**Files:**
- Create: `server/systemd/museum.service`
- Modify: `README.md`
- Modify: `PROTOTYPE.md`

**Interfaces:**
- The systemd unit runs `node server/index.mjs` from the checkout and uses `MUSEUM_DATA_DIR=/var/lib/taste-museum`.
- README documents `npm ci`, `npm run build`, `sudo install`, `systemctl enable --now`, Tailscale Serve, updates, backups, and status checks.

- [x] **Step 1: Add a least-privilege service template with an explicit working directory and data path.**
- [x] **Step 2: Update documentation to describe persistent upload behavior and the new server deployment instead of static-only hosting.**
- [x] **Step 3: Run all verification commands and inspect `git diff --check`.**
