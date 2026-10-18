# Forma — solid part design

A focused mechanical CAD foundation built with OpenCascade (WebAssembly), Replicad, TypeScript, Three.js, and Vite. Geometry operations run in a background worker. Three.js renders tessellations of the resulting boundary-representation solid; it does not define the part.

## Run on Windows, macOS, or Linux

Install Node.js 22.12+ (Node 24 recommended), extract this repository, and open a terminal in its folder:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173. The first load downloads a roughly 23 MB geometry engine from the app server. Kernel status must show Ready before modeling.

## First complete workflow

1. Start in Sketch 1 on the XY plane. Edit Width and Depth. The rectangle is centered on the origin and axis-aligned; this specific sketch is fully defined by those dimensions.
2. Choose Extrude plate to edit thickness, then Create solid. Alternatively, Finish sketch creates the extrusion with the default 8 mm thickness.
3. Choose Edit sketch, then Hole profile. Click inside the rectangle to place a circle. Edit its diameter and center X/Y. Existing solids automatically rebuild with a real boolean through-cut.
4. Finish sketch to inspect the solid. Orbit by dragging, pan with right-drag, and zoom with the scroll wheel.
5. Save project downloads a `.forma` JSON document containing editable features. Open reconstructs the solid from those features. Browser recovery is also saved locally, but is not a replacement for downloading a project.
6. Export STEP for the CAD solid or Export STL for a manufacturing mesh. All dimensions are in millimeters.

Width, depth, thickness, and hole position/diameter remain editable. Undo and redo rebuild feature states. Invalid dimensions, overlapping/touching holes, and holes extending outside the plate are rejected without replacing the last valid part.

## Current scope

This version supports **one rectangular plate, one extrusion, and up to 40 circular through-holes**. The width/depth and hole dimensions define a fixed sketch schema; it is not a general geometric constraint solver or freeform sketch editor. It does not implement assemblies, mates, STEP import, McMaster insertion, fillets, arbitrary profiles, or multiple bodies. The earlier mesh workspace has been replaced rather than retained as a second modeling system. Simulation, electronics, and generative design are out of scope.

Earlier mesh-prototype projects are not compatible with the new solid document format. Their old browser-storage key is left untouched.

## Validation

```sh
npm run build
npx playwright install chromium
npm run dev
# In a second terminal:
npm test
```

Browser tests verify extrusion volume, volume removed by circular through-cuts, STEP solid output, STL download, editable save/reopen, dimension rebuilds, undo/redo, and rejection of invalid files/dimensions. They use installed Chromium on the cloud image or Playwright's Chromium on other machines. Set `CAD_TEST_URL` to test a separately running production preview.

## Geometry dependencies

OpenCascade is supplied through the unmodified `replicad-opencascadejs` package; its WASM is a separate replaceable asset in the production build. See [THIRD_PARTY.md](THIRD_PARTY.md) for license and source references.
