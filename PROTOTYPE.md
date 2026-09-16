# 나의 취향 박물관 — prototype scope

Approved September 16, 2026. The first production-oriented pass keeps the approved interactive prototype while adding a local Ubuntu persistence server.

## Visual source
Approved generated mobile lobby, guide, light gallery, dark highlight gallery, add-item and inbox designs from this conversation. Ivory, Korean serif display type, burgundy controls. Four rooms; room 03 is the dark highlight gallery. Museum plan is a generated raster with accessible room buttons.

## Execution plan
1. Preserve the bundled mobile runtime. Implement app-owned screens in Prototype.tsx and prototype.css, with typed collection context and FlowStack navigation.
2. Use generated individual assets for lobby, door, rain photograph, floor plan, highlight object and album cover.
3. Connect lobby, plan selection/zoom, four galleries, item details, photo/text/link entry, inbox multiselect and room placement. Use keyboard-aware inputs and phone-scoped sheets.
4. Compile and check runtime integrity. Verify the server API, photo upload, persistence after a second server instance, and add → inbox → place → gallery in the browser. No authored device test suite in this prototype scope.
5. Compare rendered app content with approved mockups and write design-qa.md. Leave local preview open.

## Boundaries
The app has no login and is intended for one person behind Tailscale. In server mode, SQLite stores metadata and the mini PC stores uploaded originals under the configured data directory. Music demo is explicitly a synthetic sample, not a recording of a real song. User-entered links accept only HTTP(S). Editing, deletion, backup/restore, and HEIC thumbnail conversion remain future work.
