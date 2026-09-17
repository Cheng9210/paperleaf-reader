# Paperleaf Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to execute the approved design in this session. Sites ownership requires the root agent to author this checkout; independent review may be delegated.

**Goal:** Deliver a functioning Traditional Chinese paper-reading interface, with browser-local PDFs, notes, highlights, speech and annotated export.

**Architecture:** A static ES module application with PDF.js rendering, PDF-lib export, document-keyed browser storage and deterministic demonstration translations. No uploaded document is sent to an external AI service.

**Tech Stack:** HTML, CSS, JavaScript modules, PDF.js, PDF-lib, Node test runner.

**Spec:** ../specs/2026-09-16-paper-reader-design.md

## Global Constraints

- Translation and analysis must be explicitly labeled as demonstration content.
- User PDF contents and notes are device-local; storage failure must be visible.
- Selection coordinates are normalized page coordinates and must survive resizing.
- Exported PDF annotations may be flattened, with this limitation shown before download.
- Site source remains authored by the Site-owning agent.

## Task 1: Reading surface and sample document

Files: dist/index.html, dist/styles.css, dist/app.js, dist/lib/demo.js, scripts/serve.mjs, scripts/prepare-assets.mjs.

- [ ] Install pinned PDF dependencies and copy browser assets to dist/vendor.
- [ ] Create a warm ivory and sage reading surface: compact brand bar, document toolbar, page rail, original PDF pane, translation pane and collapsed notes drawer.
- [ ] Generate a 3-page original sample paper with PDF-lib, title, abstract, sections and a visual figure. Declare it an illustrative document, not a published paper.
- [ ] Start retained preview, request the exact server URL and show the initial reading surface in Codex.

## Task 2: Document state, coordinates, keyboard and notes

Files: dist/lib/core.js, dist/lib/storage.js, dist/lib/pdf.js, dist/lib/notes.js, tests/core.test.mjs.

Interfaces: normalizedRect(rect, bounds) returns {x,y,width,height}; shouldSpeak(event, selection) returns boolean; documentKey(bytes) resolves a SHA-256 string; noteSections is the exact Markdown section list.

- [ ] Write tests before core functions exist, including a resized selection and an input focus case.

```js
assert.deepEqual(normalizedRect({left:50,top:100,width:100,height:20},{left:0,top:0,width:500,height:1000}),{x:.1,y:.1,width:.2,height:.02});
assert.equal(shouldSpeak({code:'Space',target:{tagName:'TEXTAREA'}},'attention'),false);
```

- [ ] Run `node --test tests/core.test.mjs` and confirm missing module failure, then implement the functions and rerun.
- [ ] Implement PDF load with race protection, page navigation, resize-aware render and text selection. Invalid documents retain the previous working document.
- [ ] Implement pointer and keyboard splitter control, zoom, mobile tabs, selected-text popover and safe speech handling.
- [ ] Save notes and annotations by document digest, restore on reimport and show storage errors. Store notes only; the user reimports a PDF after refresh.
- [ ] Build five notebook sections and eight architecture subsections, source quotation capture and source-page navigation; download Markdown.

## Task 3: Annotation and export

Files: dist/lib/export.js, dist/app.js, tests/export.test.mjs.

Interfaces: exportAnnotatedPdf(bytes, annotations) resolves Uint8Array. Annotation fields are id, page, kind, rects, text and color; normalized rectangles use top-left page coordinates.

- [ ] Write an export test using a one-page PDF that asserts highlights are present and original bytes remain unchanged; watch it fail before implementation.
- [ ] Implement highlights, placed text comments, delete and undo. Recompute overlays from normalized rectangles on zoom and window resize.
- [ ] Export highlights using PDF coordinates; render Chinese comment text to transparent image stamps using a browser canvas so all characters survive export without a remote font service.
- [ ] Verify output by opening the exported PDF and inspecting readable comments and aligned highlights.

## Task 4: Validation and delivery

Files: README.md, docs/superpowers/verification.md, .openai/hosting.json.

- [ ] Check actual browser flow: upload valid and invalid PDFs, split dragging, selection, speech key/input behavior, notes persistence, annotation deletion/undo, download and narrow viewport.
- [ ] Register optional WebMCP read-state and open-notebook actions via feature detection. Validate in supported browser context, or record unavailable.
- [ ] Run all Node tests and syntax checks, inspect desktop/mobile screenshots, fix reproducible defects and record remaining limits.
- [ ] Save the exact source, publish owner-private using Sites, verify the deployment and present the deployed URL.

## Execution decision

The user approved implementation. Proceed inline without another method-selection prompt; the Site-owning agent must edit the checkout. The workspace is a new directory with no existing Git repository or baseline tests, so no existing branch requires isolation.
