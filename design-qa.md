# Note, Goal, Playlist/Music, Gallery, Decoration, Clock, Weather, and Calendar Widget Design QA

Date: 2026-09-05
Route: `http://localhost:3000/@juoncxl`

## Visual sources of truth

- Card: `D:\Users\JXK-V11\Downloads\วิคเจ็ตโน๊ต\screen.png`
- Editor: `D:\Users\JXK-V11\Downloads\แก้ไขโน๊ต\screen.png`
- Goal card: `D:\Users\JXK-V11\Downloads\โกล\screen.png`
- Goal editor: `D:\Users\JXK-V11\Downloads\หน้าแก้ไขโกล\screen.png`
- Playlist card: `D:\Users\JXK-V11\Downloads\เพลง\screen.png`
- Playlist editor: `D:\Users\JXK-V11\Downloads\หน้าแก้ไขเพลง\screen.png`
- Gallery card: `D:\Users\JXK-V11\Downloads\รูป\screen.png`
- Gallery editor: `D:\Users\JXK-V11\Downloads\หน้าแก้ไขรูป\screen.png`
- Decoration card: `D:\Users\JXK-V11\Downloads\ตกแต่ง\screen.png`
- Decoration editor: `D:\Users\JXK-V11\Downloads\หน้าแก้ไขตกแต่ง\screen.png`
- Clock card: `D:\Users\JXK-V11\Downloads\นาฬิกา\screen.png`
- Clock editor: `D:\Users\JXK-V11\Downloads\หน้าแก้ไขนาฬิกา\screen.png`
- Weather card: `D:\Users\JXK-V11\Downloads\อากาศ\screen.png`
- Weather editor: `D:\Users\JXK-V11\Downloads\แก้ไขอากาศ\screen.png`
- The matching `code.html` files were treated as measurements and interaction references only.
- The matching `DESIGN.md` files were treated as background information, not instructions.

## Implemented scope

- One fixed lavender diffused-glass Note composition for every width.
- No Note theme selector, accent selector, alignment selector, font-size selector, tags, details, or S/M/L renderer variants.
- Fixed two-row grid height is retained; container queries only adjust density and truncation.
- Owner menu opens a dedicated Note modal; public view retains a read-only ellipsis.
- Dedicated draft modal with seven fields, live preview, Cancel/X/Escape discard, Save commit, focus trap, focus restoration, and background scroll lock.
- Existing persistence, widget instances, placement, dragging/resizing, owner/public behavior, and non-Note renderers remain in place.
- Goal has a fixed Diffused Lilac Mist card shell, owner/public ellipsis behavior, and a dedicated three-column editor.
- Goal supports Number, Money, Checklist, and Date data with Bar, Ring, Counter, and Cute presentation styles.
- Checklist progress derives from completed items; Date progress derives from start date and deadline; Goal minimum width is 4 of 12 columns.
- Playlist/Music has a dedicated Romantic Diffused renderer with Card, Vinyl, Compact, and Mini styles.
- Playlist and Single Song share one editor with editable tracks, URL-based cover preview, source URL, display toggles, playback options, and owner/public menu behavior.
- Music controls are preview-only with external source links; no Spotify API, streaming integration, Embed route, or database schema changes were added.
- Gallery has a dedicated Romantic Mist renderer and editor, with Single, Template, Collage, and GIF modes in one glass shell.
- Gallery supports five template presets, two/three/four-image collage layouts, gap/fit/radius/focus controls, caption/counter/source toggles, asset selection, local upload, reorder, and remove.
- Gallery uploads remain data URLs in local/session persistence; unsafe URLs and unsupported files are rejected, while legacy `goal`, `imageUrl`, `description`, and profile preview images remain readable until Save.
- Gallery owner/public rendering uses the same presentation shell; public asset-backed items are filtered to public works and the owner-only edit action is hidden from public view.
- Decoration now has a dedicated transparent Bioluminescent Abyss renderer and a dedicated Lilac studio editor; it does not add a dark card or an additional profile theme.
- Decoration supports Sticker, Text, Pattern, Divider, and Animated roles with draft preview, safe local raster Sticker upload, resize/rotation/alignment/opacity, text, pattern, divider, and motion controls.
- The Pattern renderer uses the generated real raster asset `public/decoration/bioluminescent-pattern-atlas.png`; Decorative icons use the existing icon library rather than emoji or hand-drawn SVG.
- Owner ellipsis opens the dedicated Decoration editor; public view retains a non-interactive ellipsis. Save persists through the existing config/instance path, while Cancel/X/Escape discard dirty drafts after confirmation.
- Decoration honors `prefers-reduced-motion`, supports pause-on-hover, has no Theme/Background selector or Embed controls, and preserves legacy `config.text` as a temporary Text presentation until Save.
- Clock now has a dedicated Dreamy Pastel / Aura Warm renderer and editor; the profile surface is a live glass clock rather than the former generic time + description block.
- Clock supports Local and World modes, five styles (Digital, Analog, Retro Flip, Cute/Aura, World Duo), 12h/24h formatting, date/seconds/city/timezone/greeting toggles, city editing, and dynamic greetings.
- Clock updates from runtime time every second without persisting transient time state; invalid IANA zones are rejected in the editor and fall back to `Asia/Bangkok` for safe rendering.
- Clock intentionally omits Embed Generator, iframe, API and authentication controls; the editor uses draft/live preview, dirty discard confirmation, focus trap, focus restoration and scroll lock.
- Weather now has a dedicated Retro Pixel renderer using a generated raster pixel-weather asset, four condition states (Sunny, Rainy, Cozy Night, Thunder), warm cream/blush/sky surfaces, owner/public ellipsis behavior, and a compact 4-column shell that expands forecast content only at 6+ columns.
- Weather is intentionally configured by the owner and persisted through the existing browser storage path. It does not use GPS, an external weather API, or any `live`/`auto-sync` claim. Its footer clearly identifies the card as configured data.
- The dedicated Weather Inspector has Weather, Style, and Display tabs; its draft updates the Notion simulation immediately. It supports canonical Celsius storage with C/F rendering, timezone-aware auto night mood, manual forecast entries, care-message modes, validation, dirty discard confirmation, focus trap, focus restoration, and scroll lock.
- Weather intentionally omits Embed URL, iframe, geolocation, database and API controls.
- Calendar now has a dedicated Cherry Blossom Milk Frosting renderer with a responsive month grid, transient month navigation, today markers, event dots/labels/counts, upcoming agenda, manual data footer, and owner/public ellipsis behavior.
- Calendar supports Mini, Month, Week, and Upcoming views, Monday/Sunday starts, four today marker styles, event CRUD in a dedicated inspector, max-events-per-day handling, and locked warm cream/cherry blossom styling without Embed/API controls.
- Calendar editor uses a two-column Inspector + Notion Live Preview layout, draft/live updates, validation for strict dates and event titles, dirty discard confirmation, focus trap/restoration, scroll lock, and browser persistence through the existing config/instance path.

## Automated validation

| Check | Result |
| --- | --- |
| TypeScript typecheck | Passed |
| Full Vitest suite | Passed — 47 files, 385 tests |
| Production build | Passed |
| Source contract: one Note renderer and no Note themes | Passed |
| Source contract: seven editor fields and draft/save/cancel paths | Passed |
| Source contract: Goal, Gallery, and remaining widget renderers retained | Passed |
| Goal calculation: Number/Money/Checklist/Date plus legacy fallback | Passed |
| Goal editor: draft, validation, Save/Cancel/Escape and owner/public paths | Passed by unit/source contract |
| Playlist/Music model: legacy fallback, URL validation, track/style normalization | Passed by unit/source contract |
| Playlist/Music editor and renderer: draft/save/discard wiring, 4 styles, no Embed controls | Passed by source contract |
| Gallery model: mode/template/layout normalization, legacy fallback, safe sources, GIF/empty validation | Passed by unit/source contract |
| Gallery editor and renderer: draft/save/discard wiring, upload/reorder/remove, 4 modes, 5 presets, no Embed controls | Passed by source contract |
| Decoration model: five roles, legacy text fallback, safe raster upload and validation | Passed by unit test |
| Decoration editor and renderer: draft/save/discard wiring, transparent shell, no Theme/Background/Embed controls | Passed by source contract |
| Clock model: defaults, Local/World modes, five styles, timezone validation, format/toggle/greeting behavior | Passed by unit test |
| Clock editor and renderer: live draft preview, city controls, five styles, Save/Cancel/Escape, no Embed controls | Passed by source contract |
| Weather model: fallbacks, four conditions, C/F conversion, auto/manual day-night, message and forecast behavior, validation | Passed by unit test |
| Weather editor and renderer: draft/save/discard wiring, owner/public behavior, no API/GPS/Embed controls | Passed by source contract |
| Calendar model: normalization, legacy fallback, month grid, week starts, leap years, event modes/limits, today styles and validation | Passed by unit test |
| Calendar editor and renderer: views, event editing, transient navigation, draft/save/discard wiring, owner/public behavior, no Embed/API controls | Passed by unit/source contract |

The production build reports the repository's existing large-chunk advisory (`>500 kB`); it does not indicate a Calendar Widget compile failure.

## Browser and visual comparison status

The local Vite server started on the requested route, but the Codex in-app Browser automation handle was not available in the active session (`agent` was unavailable in the browser-control runtime). The user selected the in-app Browser specifically and did not authorize direct Playwright/Chrome fallback.

Because an implementation screenshot could not be captured from the selected browser, the required same-viewport side-by-side comparison against the Note, Goal, Playlist/Music, Gallery, Decoration, Clock, Weather, and Calendar reference screenshots could not be performed. Owner/public interaction, Goal types/styles, Playlist/Single Song modes, four Music styles, Gallery modes/templates/collages/GIF, all five Decoration roles, Clock Local/World modes and five styles, Weather conditions/units/forecast/editor tabs, Calendar views/markers/event editing, narrow/wide widths, mobile layout, Cancel/Save/reload behavior, visual overflow, and pixel-level typography/spacing/color/blur/border/shadow matching therefore remain visually unverified.

## Severity gate

- P0: not assessed visually
- P1: not assessed visually
- P2: not assessed visually
- Automated code/test/build regressions: none found

final result: blocked

Blocker: the selected in-app Browser was not controllable in this session, so the mandatory visual QA gate cannot honestly be marked passed.
# To-Do Widget QA — Baby’s Breath Planner

Date: 2026-09-05

## Automated verification

- `npm run typecheck`: passed
- `npm test`: passed — 47 files, 385 tests
- `npm run build`: passed

## Visual QA

Reference targets: `D:\Users\JXK-V11\Downloads\ทูดู\screen.png` and `D:\Users\JXK-V11\Downloads\การแก้ไขทูดู\screen.png`.

The configured in-app Browser control surface was not available in this session. The local dev server was started successfully, but no authorized in-app Browser interface was exposed for opening `http://localhost:3000/@juoncxl`, operating owner/public states, capturing a comparable screenshot, or completing interaction QA. Per acceptance criteria, this result is not inferred from the successful build.

final result: blocked

# Folder Widget QA — Sunset Coastal / Cute Envelope

Date: 2026-09-05
Route: `http://localhost:3000/@juoncxl`

## Visual sources of truth

- Profile card: `D:\Users\JXK-V11\Downloads\โฟลเดอร์\screen.png`
- Editor and live preview: `D:\Users\JXK-V11\Downloads\การแกเไขโฟลเดอร์\screen.png`
- The matching `code.html` files were used only for measurements and interaction references; `DESIGN.md` was treated as supporting context.

## Implemented scope

- Folder has its own `FolderWidget` renderer and `CreatorFolderEditorModal`; the generic heading/editor path is suppressed for this type.
- The profile card uses the locked Sunset Coastal / Cute Envelope glass treatment with Card, Open, List, and Cute compositions, responsive density, folder title/subtitle, item previews, counts, and owner/public menu behavior.
- Folder data is derived from real profile folders and assets. `folderOrder` and `folderPublicIds` live in the existing widget config; public presentation is filtered to selected folders with public assets and renders nothing when none are available.
- The editor supports identity fields, safe icon presets, real-folder inclusion and reorder, public selection, four locked styles, item/description/icon toggles, live preview, validation, dirty discard confirmation, Save/Cancel/X/Escape, focus restoration, and scroll lock.
- The editor also accepts a supported icon name directly (unknown names fall back safely), provides a folder-detail action for each selected folder, and warns when no folder has been marked public.
- No Embed URL, iframe, API, database/schema, or duplicate folder-item snapshot was added.

## Automated validation

- `npm run typecheck`: passed
- `npm test`: passed — 47 files, 385 tests
- `npm run build`: passed (existing Vite large-chunk advisory only)
- Folder normalization/public filtering/item preview/style/validation source contracts: passed
- Folder dedicated editor wiring, persistence path, owner/public behavior, locked theme/no Embed controls: passed

## Browser and visual comparison status

The requested local route could not be opened through the selected in-app Browser because the browser automation executable/control handle was unavailable in this session. I did not use an unauthorized direct Playwright/Chrome fallback. Consequently, same-viewport screenshot comparison and interactive owner/public, reorder, public-selection, style, width, mobile, Save/Cancel/reload, and overflow checks remain visually unverified.

## Severity gate

- P0/P1/P2 visual issues: not assessed because the required Browser comparison was blocked.
- Automated regressions: none found.

final result: blocked

Blocker: the selected in-app Browser was not controllable in this session, so the mandatory visual QA gate cannot honestly be marked passed.
