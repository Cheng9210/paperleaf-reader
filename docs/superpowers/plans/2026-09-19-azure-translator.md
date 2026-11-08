# Azure Translator F0 implementation plan

**Goal:** Connect the approved Azure free-tier choice to the existing reader, with English-to-Traditional-Chinese translation and precise word alignment.

**Approved scope:** User selected Azure free tier after the service comparison. Preserve local-only hosting, existing reading/annotation UI and notes. No Azure resource creation or billing-plan changes by the agent.

**Design:** Browser extracts text and its PDF item offsets. A localhost-only Node endpoint owns the key and calls Microsoft's fixed global text-translation endpoint with `from=en`, `to=zh-Hant`, `includeAlignment=true`. Cache results by source content and keep an estimated local monthly cap of 2M characters. Users explicitly start translation; a serial queue translates page by page and can pause. Local configuration dialog validates the key with a small text request and requires confirmation that the resource tier is F0. Existing demo remains available without credentials.

## Tasks

- [x] Write failing extraction/alignment and Azure adapter/security tests.
- [x] Implement `scripts/azure-service.mjs`, `scripts/http-server.mjs`; connect `scripts/serve.mjs`. Fixed upstream host, no raw upstream errors or key returned, loopback Host/Origin/custom-header checks, bounded input, timeout, cache and serialized quota updates.
- [x] Implement `dist/lib/pdf-text.js` for paragraph blocks, PDF item offsets, alignment projection validation and exact selected ranges. Keep separate source occurrences; never whole-paragraph fallback.
- [x] Implement `dist/lib/azure-reader.js`: configuration, queue/pause/retry, document-switch cancellation, translation rendering, mapped selection.
- [x] Connect compact translation controls in index/app/CSS and tag PDF text spans with stable item indices. Preserve demo, annotations and notebook behavior.
- [x] Run unit/integration tests using deterministic Azure-shaped responses; browser test settings and translation flow without pretending mocked output is live Azure.
- [x] Add F0 setup instructions and local credential/cache exclusions; perform read-only code review. Real Azure validation requires user's key and resource region.

## Acceptance

- Key is stored outside dist under ignored `.local/`; no key returned to browser or logged.
- Only extracted paper text goes to Microsoft after the user starts translation. No PDF upload or notes submission.
- Repeated input is cached, no auto-switch to paid tiers, conservative local quota guard. Azure portal remains authoritative for actual quota/tier.
- Selected repeated English words map by source offset, partial word/unknown mappings do not broaden to paragraphs.
- Missing credentials, invalid authentication, quota/rate errors, scans, cancellation and document changes have explicit UI states.
- Do not claim live connection verified without successful real Azure response.

## Final verification

32 Node tests pass (2026-09-20). Browser verified settings and original PDF/notes; no console errors. Reviewer findings on cross-item alignment and chunked UTF-8 were corrected with regression tests. Browser live translation remains pending user Azure F0 credentials; no live Azure success is claimed.
