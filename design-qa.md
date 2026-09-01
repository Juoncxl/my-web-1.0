# Creator Space Code Preview — Design QA

- Source visual truth: `D:/Users/JXK-V11/Downloads/Screenshot_224.png`
- Reported broken state: `D:/Users/JXK-V11/Downloads/Screenshot_222.png`
- Authored-code reference: `D:/Users/JXK-V11/Downloads/Screenshot_223.png`
- Implementation screenshot: `D:/Users/JXK-V11/CodexHome/my-web-1.0-phase1/.qa-code-preview.png`
- Combined comparison: `D:/Users/JXK-V11/CodexHome/my-web-1.0-phase1/.qa-code-preview-comparison.png`
- Browser viewport: 1100 x 900 CSS px, device scale factor 1
- Compared region: top 488 x 452 px of source against centered 480 x 452 px authored preview region
- State: Create Work → UI Code Block → CODE input → PREVIEW

## Full-view comparison evidence

The broken state rendered a white document with visible content that should have been hidden. The post-fix capture renders a constrained 480 px dark composition with the authored radial background, gold border, positioned vertical Chinese title, glow, custom font, absolute-positioned decorative content, and no visible `.h` text.

## Focused region evidence

The focused comparison covers the most important top portion of the authored composition because this is where the reported failure was clearest: background, font import, vertical title, glow, positioning, border, and hidden content. The source-specific rose/thorn raster assets are not recreated in the QA fixture; the fixture checks that authored CSS and HTTPS resources are preserved and rendered rather than validating those user-owned asset URLs.

## Required fidelity surfaces

- Fonts and typography: passed. The `@import` URL containing `wght@400;700` is preserved byte-for-byte; `Zhi Mang Xing` and `Charmonman` visibly render in the implementation capture.
- Spacing and layout rhythm: passed for the reported defect. The authored 480 px composition, 640 px content height, centering, border inset, absolute positioning, and overflow behavior apply.
- Colors and visual tokens: passed. The authored black/brown radial background, gold foreground, glow, and border replace the incorrect white unstyled document.
- Image quality and asset fidelity: renderer passed. HTTPS/data/blob image sources remain available to the iframe CSP. Exact source raster fidelity remains dependent on the URLs present in the user's pasted code and the source host allowing hotlinking.
- Copy and content: passed. Authored Chinese/Thai copy remains intact, while `.h{display:none}` content no longer leaks into the visible preview.

## Comparison history

### Iteration 1 — blocked

- Finding: P0 — the preview showed raw document flow instead of the authored composition.
- Evidence: `Screenshot_222.png` displayed a white background, unhidden square/text rows, and an unpositioned rose image.
- Root cause: `sanitizePreviewCss()` rewrote user CSS before the browser parsed it. Complex `@import` URLs and authored CSS were therefore not a reliable pass-through.

### Iteration 2 — passed

- Fix: authored CSS is now preserved byte-for-byte. Security remains enforced by the iframe sandbox and CSP rather than regex-based CSS mutation.
- Runtime checks: the iframe `srcdoc` retained the full Google Fonts import with `wght@400;700`, `.h{display:none}`, and the authored radial gradient. No runtime exceptions were observed.
- Visual evidence: `.qa-code-preview-comparison.png` shows the source composition on the left and the post-fix styled iframe fixture on the right. The reported failure mode—unstyled raw HTML on white—is no longer present.

## Findings

No remaining P0/P1/P2 finding for the HTML + CSS rendering lifecycle. A remote host can still prevent one of its own images or fonts from loading; that is an external-host restriction rather than CSS mutation by the preview.

## Primary interactions tested

1. Open Create Work.
2. Add UI Code block.
3. Type/paste HTML + CSS containing a multi-family Google Fonts `@import`, reset rules, hidden selectors, absolute positioning, animation, gradient, text shadow, custom fonts, and Thai/Chinese copy.
4. Switch from CODE to PREVIEW.
5. Confirm the resulting screenshot is styled and confirm the original CSS substrings remain in iframe `srcdoc`.
6. Confirm browser runtime exception list is empty.

final result: passed

## Creator Space final parity pass — current run

- Production parity implementation was updated from the approved `creator-space-preview.html` reference.
- Static verification and local production HTTP checks passed.
- Browser visual automation was blocked in this environment, so desktop/mobile visual QA remains for manual review.

final result: blocked
