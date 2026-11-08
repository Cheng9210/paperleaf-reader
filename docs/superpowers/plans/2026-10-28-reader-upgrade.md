# Reader upgrade implementation plan

Approved design: retain original page geometry and images in Chinese view, normalize drop caps, light Chinese paper within dark chrome, four persistent view modes, one-click whole-document translation with saved progress and remembered server-side credentials.

Architecture: render PDF page artwork into a background canvas; mask only extracted text bounds and place translated text in original blocks with fitted typography. Keep exact source spans for alignment. Reuse existing server translation cache and add document-indexed browser progress storage. Native scrolling, restrained transitions, reduced-motion support.

- [x] Add geometry and drop-cap regression tests; implement original-page translation renderer with image preservation and readable overflow fallback.
- [x] Add persistent reading modes and dark chrome with light document pages; verify split resizing and single-pane navigation.
- [x] Restore translation progress and credential status; ensure one-click translation traverses every page with bounded retries and quota stops.
- [x] Run regression tests, browser checks and real-document rendering. Preserve current annotations and credentials.

Constraints: no publishing, no billing changes, no secrets in logs, no silent truncation of Chinese text. Source images keep original colors. Whole-document work remains subject to provider availability and free-tier quota.

Verification: 62 relevant regression tests passed, then the added backend English-copy rejection test passed with all 11 Gemini/quality tests. The unrelated chrome-translator test still references a missing legacy module and was excluded. Browser checked real 16-page paper, light Chinese pages, original figure preservation, reversed panes, Chinese-only and English-only modes, Enter page navigation, saved progress restoration. English-only cached body text is invalidated and being repaired through Gemini; completion depends on the provider.
