# Design QA

source visual truth path: approved mobile lobby, guide, gallery, add-item and inbox mockups from this conversation; generated raster assets in `public/museum/`
implementation screenshot path: `qa/lobby-screen.png`, `qa/pixel-map.png`
viewport: iPhone content screen 393 x 852 CSS px at deviceScaleFactor 1; Pixel 10 content screen 427 x 952 CSS px at deviceScaleFactor 1
source and implementation pixel dimensions: implementation captures were normalized to the device content element at the target CSS dimensions
state: lobby, guide with room 03 selected, guide zoom sheet, room 03 highlight gallery, add-item form, inbox placement, Pixel 10 guide

## Full-view comparison evidence

- Lobby preserves the approved ivory museum palette, serif title hierarchy, vertical entrance list, burgundy entry action and top 안내도 affordance.
- Guide preserves the four-room architectural plan, central corridor, selected-room tint, room legend and selected-room entry action.
- Room 03 uses the approved dark highlight treatment and focused ceramic object imagery.
- Add-item and inbox views use the approved low-friction collection workflow and keep the content session-only for this prototype.

## Focused interaction evidence

- Verified lobby → 안내도 in the in-app browser.
- Selected 03 in the plan and confirmed `03 · 하이라이트` plus `오래 곁에 둔 것들` in the detail region.
- Entered room 03, opened `기록 펼쳐보기`, and dismissed the detail sheet.
- Used the example photo, selected room 02 in the sheet, saved, and verified the new `이름 없는 사진` item in room 02.
- Switched to 링크, rejected an invalid URL with the visible Korean validation message, then saved `https://example.com/museum` and verified it in the inbox.
- Selected two inbox items, moved them to room 04, and verified both appear in that gallery.
- Opened the guide zoom sheet, selected room 03, closed it, and verified the selected-room section updated.
- Switched the bundled device picker from iPhone to Pixel 10 and verified the content screen measures 427 x 952 CSS px.
- Browser console logs: no errors or warnings observed during the interaction pass.
- `npm run build`, `npm run test:sites` (4/4) and `npm run check:runtime` pass. The template's `npm run test:runtime` suite is present but cannot launch because the local Playwright Chromium executable is not installed; the interactive browser pass above covered the prototype states directly.

## Required fidelity surfaces

- Fonts/typography: Noto Serif KR for display and Noto Sans KR for controls/body, with responsive Korean wrapping.
- Spacing/layout rhythm: 20–22px content margins, fixed template header, scrollable museum content and touch-sized controls.
- Colors/tokens: ivory surfaces, charcoal ink, neutral rules, burgundy primary actions and charcoal/brass highlight gallery.
- Image quality/assets: generated floor plan, lobby, doorway, rain, highlight mug and album artwork are used as raster assets; no CSS drawings stand in for visible museum imagery.
- Copy/content: Korean labels match the approved flow and clearly mark example collection items.

## Findings

No actionable P0/P1/P2 differences remained in the verified prototype states. The generated mockups are design references rather than pixel-identical production screens, so minor raster crop and font-rendering differences remain acceptable for this interactive prototype.

## Final result

passed
