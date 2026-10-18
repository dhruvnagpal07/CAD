# Geometry engine notices

Forma uses third-party libraries distributed separately through npm. Their license files are included in the installed packages.

- **replicad** — MIT; source: https://github.com/sgenoud/replicad
- **replicad-opencascadejs** — LGPL-2.1-only; build source: https://github.com/sgenoud/replicad/tree/main/packages/replicad-opencascadejs ; package source distribution: https://www.npmjs.com/package/replicad-opencascadejs . This application does not modify the package or its WebAssembly binary. The binary is emitted as a separate asset by Vite and can be replaced with a compatible build.
- **Open CASCADE Technology** — LGPL 2.1 with the OCCT exception; upstream source and license: https://github.com/Open-Cascade-SAS/OCCT
- **Three.js** — MIT; source: https://github.com/mrdoob/three.js
- **Lucide** — ISC; source: https://github.com/lucide-icons/lucide

When distributing an application bundle, retain the relevant package license notices and comply with their source and relinking obligations. This repository distributes application source and a dependency lockfile, rather than a vendored geometry binary.
