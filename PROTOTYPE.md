# 나의 취향 박물관 — prototype scope

Approved September 16, 2026. Interactive prototype only; production work is deferred.

## Visual source
Approved generated mobile lobby, guide, light gallery, dark highlight gallery, add-item and inbox designs from this conversation. Ivory, Korean serif display type, burgundy controls. Four rooms; room 03 is the dark highlight gallery. Museum plan is a generated raster with accessible room buttons.

## Execution plan
1. Preserve the bundled mobile runtime. Implement app-owned screens in Prototype.tsx and prototype.css, with typed in-memory collection context and FlowStack navigation.
2. Use generated individual assets for lobby, door, rain photograph, floor plan, highlight object and album cover.
3. Connect lobby, plan selection/zoom, four galleries, item details, photo/text/link entry, inbox multiselect and room placement. Use keyboard-aware inputs and phone-scoped sheets.
4. Compile and check runtime integrity. Explore the rendered prototype with the in-app browser and verify add → inbox → place → gallery, plus normal and highlight navigation and input validation. No authored device test suite in this prototype scope.
5. Compare rendered app content with approved mockups and write design-qa.md. Leave local preview open.

## Boundaries
Session-only state. Reload resets data. No auth, database, cloud uploads, synchronization, publication or production privacy claims. Uploaded photos remain object URLs in the local browser session. Music demo is explicitly a synthetic sample, not a recording of a real song. User-entered links accept only HTTP(S).
