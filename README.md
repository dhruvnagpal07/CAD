# Forma CAD

A browser-based mechanical modeling and assembly prototype built with TypeScript, Three.js, and Vite.

## Develop

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Run `npm run build` for type checking and a production build.

## Current capabilities

- Orbit, pan, zoom, top/front views, grid, fit, and selection.
- Create dimensioned boxes, cylinders, and extruded rectangular profiles.
- Edit component position and appearance; duplicate, hide, delete, undo, and redo.
- Import single-mesh STL, OBJ, and self-contained GLB files. Mesh files must use millimeters.
- Export the assembly as STL. This flattens the assembly to a mesh and does not preserve component metadata.
- Local browser persistence of primitive components and document title. Imported meshes are session-only.
- McMaster-Carr catalog link and manual import guidance.

This is not yet a solid CAD system. Parametric sketch constraints, boolean operations, edge fillets, STEP/IGES, and mechanical assembly mates are not implemented. The rigid group action only records grouping metadata. No simulation, electronics, or generative design is included.

The initial bracket assembly is a sample project, not a manufacturing-validated design.
