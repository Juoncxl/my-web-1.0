# Idea Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Owner-only idea inbox with server timestamps and edit history, shown as a global inbox, on each Work's detail page, and as a tab in the Work editor.

**Architecture:** Ideas live in one private Drive JSON file (`cxl-owner-ideas.json`) next to the Collab progress file. The existing `api/cxl/collab-progress.ts` function gains `?store=ideas` (Hobby plan: 12 functions max, 11 used). Pure rules in `src/server/cxlIdeas.ts`; one shared React list component used in three places.

**Tech Stack:** TypeScript, React, Vitest, Vercel Node functions, Google Drive v3 REST.

**Spec:** `docs/superpowers/specs/2026-10-02-idea-inbox-design.md`

## Global Constraints

- Visible to the signed-in Owner only; never in public projections, summaries or snapshots.
- `id` and `createdAt` are set by the server; `createdAt` never changes.
- text: trimmed, 1–4000 characters · ideas per file: max 2000 · history per idea: max 50 (drop oldest).
- status values: `'waiting' | 'used' | 'dropped'` (Thai labels รอใช้ / ใช้แล้ว / ทิ้ง).
- workId: `/^asset_[A-Za-z0-9_-]{1,96}$/` or `null`.
- No new file under `api/`.
- All user-facing copy in Thai. Date format: `จดเมื่อ 2 ต.ค. 2569 · 21:14 น.` (th-TH, Asia/Bangkok).
- Writes need the Owner session cookie and the CSRF header, like the Collab progress POST.

## Review Focus

- Two tabs adding ideas at once: each POST must re-read the file before applying, so neither idea is lost.
- Save fails (offline / expired login / Drive not connected): the typed text stays in the box and a Thai message shows.
- Editing an idea to the same text: no history entry, `updatedAt` unchanged.
- A Work in Trash or deleted: its ideas still show in the global inbox (chip without a working link is fine), never crash.
- `?store=ideas` must not read or write the Collab progress file, and plain `collab-progress` calls must behave exactly as before.

---

### Task 1: Idea rules (pure)

**Files:**
- Create: `src/server/cxlIdeas.ts`
- Test: `src/server/cxlIdeas.test.ts`

**Interfaces:**
- Produces:
  - `type IdeaStatus = 'waiting' | 'used' | 'dropped'`
  - `interface Idea { id; text; status; workId: string | null; createdAt; updatedAt; history: Array<{ text: string; replacedAt: string }> }`
  - `interface IdeaFile { version: 1; ideas: Idea[] }`
  - `type IdeaOp = { op: 'add'; text: string; workId?: string | null } | { op: 'edit'; id: string; text: string } | { op: 'status'; id: string; status: IdeaStatus } | { op: 'move'; id: string; workId: string | null } | { op: 'delete'; id: string }`
  - `sanitizeIdeaFile(value: unknown): IdeaFile` — drops malformed entries, keeps valid ones
  - `parseIdeaOp(value: unknown): IdeaOp | null`
  - `applyIdeaOp(file: IdeaFile, op: IdeaOp, now: Date, newId: () => string): IdeaFile` — throws `IdeaError` with `status` 404 (unknown id) or 409 (limit)
  - `class IdeaError extends Error { status: number }`
  - `IDEA_LIMITS = { text: 4000, ideas: 2000, history: 50 }`

- [ ] **Step 1: Write failing tests** in `src/server/cxlIdeas.test.ts`:
  - `add` → new idea first in list, `status 'waiting'`, `createdAt === updatedAt === now.toISOString()`, id from `newId`, text trimmed; workId kept when valid.
  - `parseIdeaOp` rejects: empty/whitespace text, text of 4001 chars, bad workId `'../x'`, unknown op, extra status `'done'`.
  - `edit` → old text pushed to `history` as `{ text: old, replacedAt: now }`, `createdAt` unchanged, `updatedAt` = now; same text → file unchanged.
  - history caps at 50, oldest dropped.
  - `status` / `move` update `updatedAt`, never `createdAt`; `delete` removes.
  - unknown id → `IdeaError` status 404; adding the 2001st idea → status 409.
  - `sanitizeIdeaFile({ ideas: [validIdea, { id: 1 }] })` keeps only the valid one; `sanitizeIdeaFile(null)` → `{ version: 1, ideas: [] }`.
- [ ] **Step 2:** Run `npx vitest run src/server/cxlIdeas.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/server/cxlIdeas.ts` per Interfaces. New ideas go to the front (newest first).
- [ ] **Step 4:** Run the same command → PASS.
- [ ] **Step 5:** Commit `feat: idea inbox rules`.

### Task 2: Shared Drive JSON file helpers + `?store=ideas`

**Files:**
- Create: `src/server/cxlOwnerFiles.ts`
- Modify: `api/cxl/collab-progress.ts` (move its find/read/write file helpers into `cxlOwnerFiles.ts`; route `?store=ideas`)
- Test: `tests/api/cxl/collab-progress.test.ts` (create if absent; keep tests out of `api/`)

**Interfaces:**
- Consumes: Task 1 `sanitizeIdeaFile`, `parseIdeaOp`, `applyIdeaOp`, `IdeaError`.
- Produces:
  - `findOwnerFile(token: string, folderId: string, name: string): Promise<string | null>`
  - `readOwnerJson(token: string, fileId: string | null): Promise<unknown>` (null file → `{}`)
  - `writeOwnerJson(token: string, folderId: string, fileId: string | null, name: string, value: unknown): Promise<void>`
  - HTTP: `GET /api/cxl/collab-progress?store=ideas` → `{ ok: true, data: IdeaFile }`; `POST` same URL with an `IdeaOp` body → `{ ok: true, data: IdeaFile }`; 400 bad op, 401 no session, 403 CSRF, 404/409 from `IdeaError`, 503 Drive not connected.
  - `IDEAS_FILE = 'cxl-owner-ideas.json'`

- [ ] **Step 1: Write failing tests** (mock `fetch` for Drive; stub env like `tests/api/cxl/auth/authHandlers.test.ts`):
  - GET `?store=ideas` with valid session → reads `cxl-owner-ideas.json`, never queries `cxl-collab-progress.json`.
  - POST add without CSRF → 403; with CSRF → Drive PATCH/POST body contains the new idea; response `data.ideas[0].text` equals input.
  - POST edit unknown id → 404.
  - GET without `store` still returns progress data exactly as before (existing behaviour).
- [ ] **Step 2:** Run `npx vitest run tests/api/cxl/collab-progress.test.ts` → FAIL.
- [ ] **Step 3:** Extract helpers into `cxlOwnerFiles.ts`; branch on `store === 'ideas'` in the handler. Every POST: find → read → `applyIdeaOp(sanitizeIdeaFile(read), op, new Date(), randomUUID)` → write → respond.
- [ ] **Step 4:** Run the test file plus `npx vitest run tests/api src/server` → new tests PASS; the only failures are the known pre-existing ones ("keeps GO 7 media…", "rejects unauthenticated…").
- [ ] **Step 5:** Commit `feat: owner idea store on the collab-progress function`.

### Task 3: Browser client + shared `IdeaList`

**Files:**
- Create: `src/lib/ideaInbox.ts`, `src/components/IdeaList.tsx`
- Modify: `src/data/adapters/google/googleTransport.ts` (export the existing CSRF helper as `ownerCsrfToken(): Promise<string>`)
- Modify: `src/index.css` (append `.cv-idea-*` styles, light + dark)
- Test: `src/lib/ideaInbox.test.ts`

**Interfaces:**
- Consumes: Task 2 HTTP contract; `ownerCsrfToken`, `OWNER_SESSION_EXPIRED_MESSAGE` from googleTransport.
- Produces:
  - `fetchIdeas(): Promise<Idea[]>` · `sendIdeaOp(op: IdeaOp): Promise<Idea[]>` (types re-declared client-side in `ideaInbox.ts`, same shape as Task 1)
  - `formatIdeaTime(iso: string): string` → `'2 ต.ค. 2569 · 21:14 น.'`
  - `filterIdeas(ideas: Idea[], filter: 'waiting' | 'used' | 'dropped' | 'all', workId?: string): Idea[]`
  - `<IdeaList workId?: string; works?: Array<{ id: string; title: string }>; />` — input box (Enter = จด, Shift+Enter = newline), filter chips (รอใช้ default / ใช้แล้ว / ทิ้ง / ทั้งหมด), items with `จดเมื่อ …`, `แก้ไขล่าสุด …` when `history.length`, status buttons, ✏️ edit inline, 🕘 history list, 🗑 delete with `window.confirm('ลบไอเดียนี้ถาวรหรือไม่?')`; when `workId` given: shows only that Work's ideas and `add` sends that workId; when `works` given: shows a "ย้ายไปงาน…" select and a chip linking to `/work/<id>`.
  - Error copy: 401 → `OWNER_SESSION_EXPIRED_MESSAGE`; 503 → `'ยังไม่ได้เชื่อม Google Drive — เชื่อมจากเมนูบัญชีก่อน'`; other → `'บันทึกไอเดียไม่สำเร็จ ลองอีกครั้ง'`. Failed add keeps the typed text.

- [ ] **Step 1: Write failing tests** in `src/lib/ideaInbox.test.ts`: `formatIdeaTime('2026-10-02T14:14:00.000Z')` → `'2 ต.ค. 2569 · 21:14 น.'`; `filterIdeas` by status and by workId; `sendIdeaOp` posts JSON with `X-CXL-CSRF` to `/api/cxl/collab-progress?store=ideas`; 401 rejects with `OWNER_SESSION_EXPIRED_MESSAGE`.
- [ ] **Step 2:** Run `npx vitest run src/lib/ideaInbox.test.ts` → FAIL.
- [ ] **Step 3:** Implement `ideaInbox.ts`, export `ownerCsrfToken`, build `IdeaList.tsx` and styles.
- [ ] **Step 4:** Run the test → PASS; `npx tsc --noEmit -p .` → no errors.
- [ ] **Step 5:** Commit `feat: idea list component and client`.

### Task 4: Place the inbox in three spots

**Files:**
- Create: `src/components/IdeaInboxModal.tsx`
- Modify: `src/components/Header.tsx` (menu item "💡 กล่องไอเดีย" for signed-in Owner; Header owns the modal's open state so both Header call sites get it)
- Modify: `src/components/WorkDetailModal.tsx` (section "💡 ไอเดียของงานนี้" with `<IdeaList workId={asset.id} />` when `isOwner && interactionMode !== 'preview'`)
- Modify: `src/components/creator/CreatorWorkWorkspace.tsx` (`WorkSection` gains `'ideas'`; tab "ไอเดีย" only when `initialData?.id`; renders `<IdeaList workId={initialData.id} />`)
- Test: extend `src/components/creator/CreatorWorkWorkspace.test.ts` and `src/components/WorkPresentationParity.test.ts` with source assertions in their existing style

**Interfaces:**
- Consumes: Task 3 `IdeaList`.
- Produces: `<IdeaInboxModal isOpen: boolean; onClose: () => void />` — loads the Owner's Works once on open via `cxlDataService.works.fetch({ userId: currentUser.id })` and passes `{ id, title }[]` to `IdeaList`.

- [ ] **Step 1: Write failing tests**: Workspace source contains `'ideas'` in `WorkSection` and renders the tab only with `initialData?.id`; detail source renders `ไอเดียของงานนี้` only under `isOwner`; Header source contains `กล่องไอเดีย`.
- [ ] **Step 2:** Run `npx vitest run src/components` → FAIL on the new assertions.
- [ ] **Step 3:** Implement the three placements and the modal.
- [ ] **Step 4:** Run `npx vitest run src tests` → only the 5 known pre-existing failures; `npx tsc --noEmit -p .` clean.
- [ ] **Step 5:** Commit `feat: idea inbox in menu, work detail and editor`; push to `preview/google-works-read` (temporary GIT_INDEX_FILE + commit-tree, as in this repo's workflow); Owner tests on Preview together with step 3A, then one merge to main.
