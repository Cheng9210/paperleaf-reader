# Paper Translation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consent-gated full-paper translation, scan OCR, and a Chinese PDF download to Paperleaf.

**Architecture:** Keep page extraction and translation in `AzureReader`. Add a Gemini image OCR call for pages without a text layer and a separate renderer that composes each already-laid-out Chinese page into a PDF. Reuse Noto Sans and the current artwork and text placement so the download matches reading view.

**Tech Stack:** Vanilla JavaScript, PDF.js, PDF-lib, Node test runner, Gemini API.

**Spec:** `docs/superpowers/specs/2026-11-10-paper-translation-site.md`

## Global Constraints

- Require explicit approval for each new document and destination before transmitting text or images.
- Preserve page order, figures and original page sizes.
- Use Noto Sans TC, lighter body and larger headings.
- Static and local server paths must both work.

---

### Task 1: Consent and extraction gate

**Files:** `dist/app.js`, `dist/index.html`, `dist/lib/azure-reader.js`, `tests/translation-gate.test.mjs`

- [x] Write failing tests for no automatic request on import and per-document consent before start.
- [x] Implement the consent dialog and gate all translation starts.
- [x] Run targeted tests.

### Task 2: Scan OCR

**Files:** `dist/lib/browser-gemini.js`, `scripts/gemini-service.mjs`, `scripts/http-server.mjs`, `dist/lib/azure-reader.js`, `dist/lib/scan-ocr.js`, related tests

- [x] Write failing OCR parsing and service tests.
- [x] Send a low-resolution page image to Gemini only after the document consent; map returned normalized boxes to page blocks.
- [x] Keep empty pages and failed OCR visible as incomplete, not falsely translated.
- [x] Run targeted tests.

### Task 3: Chinese PDF export

**Files:** `dist/lib/translated-export.js`, `dist/lib/translation-layout.js`, `dist/app.js`, `dist/index.html`, `dist/theme.css`, tests

- [x] Write failing tests for complete-page gate, PDF page count and artwork/translation rendering.
- [x] Render each translated page with Noto Sans and original figures into a PDF, reporting overflow and preserving dimensions.
- [x] Add export choice and progress feedback, then run targeted tests.

### Task 4: End-to-end verification

**Files:** `README.md` and any defect fixes

- [x] Import the Lotus paper and verify the consent gate in the live site. Restart the local service with Gemini network access and complete all 20 pages after adding automatic splitting for incomplete model replies.
- [x] Generate the first three Lotus pages using previously completed translations; inspect title, body, figure page and overflow appendix. Then download the actual live translation as 28 pages: 20 source-layout pages and eight full-text appendix pages for 45 long blocks. Inspect the full contact sheet and figure pages.
- [x] Run the suite excluding the pre-existing untracked `chrome-translator.test.mjs` file (94 passing); update usage docs.
- [ ] Verify a live scan-only page against Gemini when service access is available.
