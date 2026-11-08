# Reading interaction revision — 2026-09-19

Scope: local changes only. No publish, deployment, or source push was performed for this revision.

## Verified

- `node --test tests/*.test.mjs`: 18 passing tests, including normalized selection, drag bounds, legacy comment migration, exact Chinese term matching, editable-field speech exclusion, wheel modifier/zoom bounds, export crop/rotation and RGB/Multiply graphics state.
- Browser at 1280×720: 42px header, 40px toolbar, 28px pane headings; continuous PDF pages. Scroll from page 1 to page 2 updates page count and translation.
- Selecting Attention marks only 注意力; no popup or full paragraph marking.
- Highlight drawn over exact word; single click preserves it, color input works, double click removes it while highlight tool is active.
- Inline Chinese text entry, color update, 14→22pt, drag position, double-click deletion, undo, and reload persistence tested.
- Browser download produced annotated PDFs. Poppler-rendered Chinese text is clear and transparent. Long English text uses matching six-line wrapping in screen and PDF.
- 390×844 responsive layout inspected: toolbar fits, continuous pages remain scrollable. Viewport reset afterwards.
- Notebook opens with the existing structured fields. Browser console reported no application errors during these checks.
- Test-created annotations were removed after QA; existing demo highlights were retained.

## Limits

- Actual translation service, arbitrary word alignment, AI analysis and OCR remain outside this interface phase. Matching is currently limited to authored demo terms.
- Space key was exercised in browser without scrolling. Audible output depends on installed system voices; this run does not independently confirm speaker audio.
- Ctrl-wheel/pinch modifier logic and zoom bounds have automated coverage; no hardware pinch gesture was exercised by automation.
- Export annotations are flattened. Inline text is rasterized on transparent canvas to preserve Chinese glyphs.

## Follow-up fixes: text placement, dragging, font, zoom

- Reproduced the placement bug in browser: click at x=610 produced text box x=422.09. Fixed `textRectAt`: preserve x/y and reduce available width near the right edge. Same browser click now produces x=610, y=300, width=68.
- Reproduced dragging the text body without movement. Text body now supports thresholded pointer dragging; browser drag moved x=610/y=300 to x=331/y=332, then a click and typing appended more text successfully. Double-click still removes only the targeted annotation.
- Bundled the official Google Fonts Noto Sans TC variable TTF and OFL license. Editor and transparent PDF stamp use the same font family and await font loading.
- Rendering now uses detached buffers. Zoom leaves the previous painted canvas in place; current canvas and text layer commit together only after both are complete. Rapid zoom waits for the gesture to settle before rendering.
- Regression tests were observed failing before fixes; full suite now has 21 passing tests. The Node render test emits PDF.js's expected recommendation to use its legacy build in Node; the app uses the browser build.
- `tests/zoom.browser.html` uses the real PDF.js renderer and tests six settled zooms plus six rapid changes. Browser result: passed=true, blankFrames=0, frames=128, replacements=7, textSpans=32. The temporary copy served from dist was removed after QA.
- Downloaded PDF rendered with Poppler and visually checked: Noto Sans TC Chinese text has transparent background, matching position and line breaks. Test annotation removed afterwards; user's existing note and notebook contents retained.
