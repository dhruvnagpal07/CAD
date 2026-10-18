import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createIcons, icons } from "lucide";
import { defaultModel, validateModel, type DocumentModel } from "./model";
import "./style.css";
const i = (name: string) => `<i data-lucide="${name}"></i>`;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
let model = defaultModel(),
  saved = JSON.stringify(model),
  mode: "sketch" | "solid" = "sketch",
  selected = "profile",
  placing = false,
  busy = false;
let undo: DocumentModel[] = [],
  redo: DocumentModel[] = [];
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><a class="brand" href="#">${i("layers-3")} forma<span>/</span><small>Part design</small></a><input id="title" aria-label="Project name" maxlength="120" value="Mounting plate"><span class="pill">SOLID CAD · mm</span><span class="header-space"></span><span id="save-state">New project</span><button id="new">${i("file-plus-2")} New</button><button id="open">${i("folder-open")} Open</button><button id="save">${i("save")} Save project</button><button id="export" class="dark">${i("upload")} Export STEP</button></header>
<nav><span class="workspace">${i("box")} Design</span><button id="sketch-tab" class="active">Sketch</button><button id="solid-tab">Solid</button><span class="header-space"></span><button id="undo" title="Undo">${i("undo-2")}</button><button id="redo" title="Redo">${i("redo-2")}</button><button id="help">${i("circle-help")}</button></nav>
<div class="toolbar"><div class="toolgroup"><button id="edit-sketch">${i("square-pen")}<span>Edit sketch</span></button><button id="rectangle">${i("rectangle-horizontal")}<span>Rectangle</span></button><button id="circle">${i("circle")}<span>Hole profile</span></button><label>SKETCH</label></div><div class="toolgroup"><button id="extrude">${i("arrow-up-from-line")}<span>Extrude plate</span></button><button id="holes">${i("circle-dashed")}<span>Cut holes</span></button><label>SOLID FEATURES</label></div><div class="toolgroup"><button id="fit">${i("scan")}<span>Fit view</span></button><button id="top">${i("panel-top")}<span>Top view</span></button><button id="stl">${i("download")}<span>Export STL</span></button><label>VIEW & EXPORT</label></div><div class="kernel-indicator"><span id="kernel-dot"></span><div>OpenCascade kernel<small id="kernel-status">Starting geometry engine…</small></div></div></div>
<main><aside class="browser"><div class="panel-title">MODEL BROWSER</div><div class="document-row">${i("chevron-down")}${i("component")}<strong id="document-name">Mounting plate</strong></div><div class="tree-row muted">${i("chevron-right")}${i("scan")} Origin <span>XY</span></div><div class="tree-row">${i("chevron-down")}${i("folder")} Sketches</div><button class="feature-row" id="profile-row">${i("square-pen")} Sketch 1 <span>XY</span></button><div id="body-tree"></div><div class="browser-note">${i("info")}<p>A real solid, built from editable dimensions. Change a feature to rebuild the part.</p></div><div class="browser-bottom"><span class="green-dot"></span> Local document <span>mm</span></div></aside>
<section class="viewport"><div class="viewport-heading"><span id="view-title">${i("square-pen")} Sketch 1 · XY plane</span><small id="view-hint">Edit dimensions in the panel. Add circle profiles for through-holes.</small></div><div id="canvas"></div><svg id="sketch" aria-label="Dimensioned sketch"></svg><button id="finish-sketch" class="dark">${i("check")} Finish sketch</button><div class="view-cube"><button id="cube-top">TOP</button><button id="cube-home">ISO</button></div><div class="viewport-bottom"><span id="geometry-status">RECTANGLE PROFILE</span><div><button id="home" title="Isometric view">${i("house")}</button><button id="grid" title="Toggle grid">${i("grid-3x3")}</button><button id="wire" title="Toggle wireframe">${i("box")}</button></div><span id="view-units">XY · mm</span></div><div id="loading">${i("loader-circle")} <span>Starting solid geometry kernel…</span></div></section>
<aside class="properties"><div class="panel-title">FEATURE PROPERTIES ${i("sliders-horizontal")}</div><div id="inspector"></div><div class="capability-note">PART DESIGN / FIRST WORKFLOW<p>Rectangle → extrusion → through-holes. STEP export preserves the solid. Assemblies and STEP import are not available in this build.</p></div></aside></main>
<footer><span class="history-label">FEATURE HISTORY</span><div id="timeline"></div><span class="header-space"></span><span id="volume">No solid yet</span></footer><div class="statusbar"><span id="status">Preparing kernel…</span><span id="interaction-hint">Sketch coordinates are measured from the center · Millimeters</span></div><input type="file" id="file" accept=".forma,.json" hidden><dialog id="dialog"></dialog><div id="toast"></div>`;
const $ = <T extends Element = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const refreshIcons = () => createIcons({ icons });
const worker = new Worker(new URL("./kernel.worker.ts", import.meta.url), {
  type: "module",
});
let seq = 0;
const requests = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();
worker.onmessage = ({ data }) => {
  const r = requests.get(data.id);
  if (!r) return;
  requests.delete(data.id);
  data.ok ? r.resolve(data) : r.reject(Error(data.error));
};
worker.onerror = (e) => {
  for (const r of requests.values())
    r.reject(Error(e.message || "Geometry worker failed."));
  requests.clear();
  $("#kernel-status").textContent = "Kernel failed to load";
};
function request(action: string, extra: object = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    requests.set(id, { resolve, reject });
    worker.postMessage({ id, action, ...extra });
  });
}
const scene = new THREE.Scene();
scene.background = new THREE.Color("#f3f5f8");
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
camera.up.set(0, 0, 1);
camera.position.set(145, -175, 155);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
$("#canvas").append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8c98a8, 2.6));
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(70, -90, 160);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 1.5);
fill.position.set(-100, 90, 60);
scene.add(fill);
const grid = new THREE.GridHelper(1000, 100, 0xc7d1dd, 0xe0e6ed);
grid.rotateX(Math.PI / 2);
grid.position.z = -0.1;
scene.add(grid);
const solid = new THREE.Group();
scene.add(solid);
let wire = false;
let metrics = { volume: 0, triangles: 0 };
function clearSolid() {
  for (const child of [...solid.children]) {
    solid.remove(child);
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  }
}
function showSolid(data: any) {
  clearSolid();
  if (data.sketch) {
    metrics = { volume: 0, triangles: 0 };
    return;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(data.mesh.vertices, 3),
  );
  g.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(data.mesh.normals, 3),
  );
  g.setIndex(data.mesh.triangles);
  const mesh = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({
      color: 0x809bb6,
      roughness: 0.34,
      metalness: 0.45,
      wireframe: wire,
    }),
  );
  solid.add(mesh);
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.Float32BufferAttribute(data.lines, 3));
  solid.add(
    new THREE.LineSegments(
      eg,
      new THREE.LineBasicMaterial({
        color: 0x324d68,
        transparent: true,
        opacity: 0.65,
      }),
    ),
  );
  metrics = { volume: data.volume, triangles: data.mesh.triangles.length / 3 };
}
function setBusy(value: boolean, label = "Rebuilding solid…") {
  busy = value;
  $("#loading").classList.toggle("visible", value);
  $("#loading span").textContent = label;
  app.classList.toggle("busy", value);
  document
    .querySelectorAll<HTMLButtonElement>(
      ".toolbar button,#export,#save,#open,#new,#undo,#redo,#finish-sketch,nav button",
    )
    .forEach((b) => (b.disabled = value));
}
function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function cache() {
  try {
    localStorage.setItem("forma-solid-v1", JSON.stringify(model));
  } catch {
    toast("Could not save browser recovery data. Download your project.");
  }
}
function dirty() {
  const changed = JSON.stringify(model) !== saved;
  $("#save-state").textContent = changed ? "Unsaved changes" : "Project saved";
  $("#save-state").classList.toggle("dirty", changed);
  cache();
}
async function commit(next: DocumentModel, label: string) {
  if (busy) return;
  const previous = structuredClone(model);
  try {
    next = validateModel(next);
    setBusy(true);
    const data = await request("build", { model: next });
    undo.push(previous);
    redo = [];
    model = next;
    showSolid(data);
    dirty();
    $("#status").textContent = label;
    render();
  } catch (e) {
    toast((e as Error).message);
    $("#status").textContent = "Feature rejected — previous part kept";
    render();
  } finally {
    setBusy(false);
  }
}
function mutate(fn: (d: DocumentModel) => void, label: string) {
  const next = structuredClone(model);
  fn(next);
  return commit(next, label);
}
function setMode(next: typeof mode) {
  mode = next;
  placing = false;
  render();
}
function input(label: string, key: string, value: number, step = "1") {
  return `<label>${label}<div class="unit-input"><input type="number" data-field="${key}" value="${value}" step="${step}" aria-label="${label}"><span>mm</span></div></label>`;
}
function render() {
  $("#title").setAttribute("value", model.name);
  ($("#title") as HTMLInputElement).value = model.name;
  $("#document-name").textContent = model.name;
  $("#sketch-tab").classList.toggle("active", mode === "sketch");
  $("#solid-tab").classList.toggle("active", mode === "solid");
  $("#sketch").classList.toggle("visible", mode === "sketch");
  $("#canvas").classList.toggle("visible", mode === "solid");
  $("#finish-sketch").classList.toggle("visible", mode === "sketch");
  $(".view-cube").classList.toggle("visible", mode === "solid");
  $("#view-title").innerHTML =
    mode === "sketch"
      ? `${i("square-pen")} Sketch 1 · XY plane`
      : `${i("box")} ${esc(model.name)} · Solid body`;
  $("#view-hint").textContent =
    mode === "sketch"
      ? placing
        ? "Click inside the rectangle to place a hole center. Escape to cancel."
        : "Dimensioned rectangle · centered on origin · all units in mm"
      : "Drag to orbit · right-drag to pan · scroll to zoom";
  $("#geometry-status").textContent = model.extruded
    ? "1 SOLID BODY · OPENCASCADE B-REP"
    : "CLOSED RECTANGLE · FULLY DIMENSIONED";
  $("#volume").textContent = model.extruded
    ? `${metrics.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm³ · 1 solid`
    : "No solid yet";
  $("#view-units").textContent =
    mode === "sketch" ? "XY · mm" : "Perspective · mm";
  $("#body-tree").innerHTML = model.extruded
    ? `<div class="tree-row">${i("chevron-down")}${i("box")} Bodies <span>1</span></div><button class="feature-row" id="body-row">${i("box")} Plate body <span>Solid</span></button>`
    : "";
  $("#timeline").innerHTML =
    `<button data-feature="profile" title="Edit Sketch 1">${i("square-pen")}<span>Sketch 1</span></button>${model.extruded ? `<span class="timeline-connector"></span><button data-feature="extrude">${i("arrow-up-from-line")}<span>Extrude 1</span></button>` : ""}${model.extruded && model.holes.length ? `<span class="timeline-connector"></span><button data-feature="holes">${i("circle-dashed")}<span>Hole cuts (${model.holes.length})</span></button>` : ""}`;
  const hole = model.holes.find((h) => h.id === selected);
  $(".properties").scrollTop = 0;
  $("#inspector").innerHTML = hole
    ? `<div class="eyebrow">THROUGH-HOLE PROFILE</div><h2>Circle ${model.holes.indexOf(hole) + 1}</h2><p class="description">Diameter and center measured from the sketch origin. Cut through the full plate.</p><div class="property-section"><h3>Dimensions</h3>${input("Diameter", "diameter", hole.diameter, ".5")}${input("Center X", "x", hole.x)}${input("Center Y", "y", hole.y)}</div><button class="remove-hole" id="remove-hole">${i("trash-2")} Remove hole</button>`
    : selected === "extrude"
      ? `<div class="eyebrow">SOLID FEATURE</div><h2>Extrude 1</h2><p class="description">Extrude the closed rectangle normal to the XY plane, along +Z.</p><div class="property-section"><h3>Extrusion</h3>${input("Thickness", "thickness", model.thickness, ".5")}<label>Operation<span>New solid</span></label><label>Direction<span>+Z · One side</span></label></div><button class="primary-action" id="apply-extrude">${i("check")} ${model.extruded ? "View solid" : "Create solid"}</button>`
      : `<div class="eyebrow">PARAMETRIC SKETCH</div><h2>Sketch 1</h2><p class="description">A centered, axis-aligned rectangle with explicit width and depth dimensions.</p><div class="property-section"><h3>Rectangle dimensions</h3>${input("Width", "width", model.width)}${input("Depth", "depth", model.depth)}<label>Plane<span>XY</span></label><label>Constraint<span class="constrained">Fully dimensioned</span></label></div><div class="property-section"><h3>Hole profiles <span>${model.holes.length}</span></h3><div class="hole-list">${model.holes.map((h, n) => `<button data-hole="${h.id}">${i("circle")} Circle ${n + 1}<span>Ø ${h.diameter}</span></button>`).join("") || "<p>No holes. Add a circle to define a through-cut.</p>"}</div><button id="add-hole" class="add-hole">${i("plus")} Add hole</button></div>`;
  $("#inspector")
    .querySelectorAll<HTMLInputElement>("[data-field]")
    .forEach(
      (el) =>
        (el.onchange = () => {
          const field = el.dataset.field!;
          const value = Number(el.value);
          if (el.value.trim() === "" || !Number.isFinite(value)) {
            toast("Enter a finite dimension.");
            render();
            return;
          }
          void mutate((d) => {
            const h = d.holes.find((h) => h.id === selected);
            if (h && ["diameter", "x", "y"].includes(field))
              (h as any)[field] = value;
            else (d as any)[field] = value;
          }, "Feature rebuilt from updated dimensions");
        }),
    );
  $("#body-row")?.addEventListener("click", () => {
    selected = "extrude";
    setMode("solid");
  });
  $("#apply-extrude")?.addEventListener("click", extrude);
  $("#remove-hole")?.addEventListener("click", () => {
    void mutate(
      (d) => (d.holes = d.holes.filter((h) => h.id !== selected)),
      "Through-hole removed",
    ).then(() => {
      selected = "profile";
      render();
    });
  });
  $("#add-hole")?.addEventListener("click", startHole);
  $("#inspector")
    .querySelectorAll<HTMLElement>("[data-hole]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.hole!;
          setMode("sketch");
        }),
    );
  drawSketch();
  refreshIcons();
}
function drawSketch() {
  const svg = $<SVGSVGElement>("#sketch");
  const w = Math.max(model.width + 70, 150),
    h = Math.max(model.depth + 65, 115);
  svg.setAttribute("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);
  const W = model.width / 2,
    D = model.depth / 2;
  const line = (x1: number, y1: number, x2: number, y2: number, cls = "dim") =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
  const f = Math.max(w / 95, 1.8);
  svg.innerHTML = `<defs><pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".18" fill="#b9c8d8"/></pattern></defs><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="url(#dots)"/>${line(-w / 2, 0, w / 2, 0, "x-axis")}${line(0, -h / 2, 0, h / 2, "y-axis")}<path d="M ${-W} ${-D} H ${W} V ${D} H ${-W} Z ${model.holes.map((h) => `M ${h.x - h.diameter / 2} ${-h.y} a ${h.diameter / 2} ${h.diameter / 2} 0 1 0 ${h.diameter} 0 a ${h.diameter / 2} ${h.diameter / 2} 0 1 0 ${-h.diameter} 0`).join(" ")}" fill-rule="evenodd" class="profile"/>${[-W, W].flatMap((x) => [-D, D].map((y) => `<rect x="${x - 0.65}" y="${y - 0.65}" width="1.3" height="1.3" class="corner"/>`)).join("")}${line(-W, -D - 8, W, -D - 8)}${line(-W, -D - 2, -W, -D - 11)}${line(W, -D - 2, W, -D - 11)}<text x="0" y="${-D - 10}" text-anchor="middle" style="font-size:${f}px" data-dimension="width">${model.width} mm</text>${line(W + 8, -D, W + 8, D)}${line(W + 2, -D, W + 11, -D)}${line(W + 2, D, W + 11, D)}<text x="${W + 11}" y="0" style="font-size:${f}px" data-dimension="depth">${model.depth} mm</text>${model.holes.map((h, n) => `<g data-sketch-hole="${h.id}" class="sketch-hole ${h.id === selected ? "selected" : ""}"><circle cx="${h.x}" cy="${-h.y}" r="${h.diameter / 2}"/><path d="M ${h.x - 2} ${-h.y} h 4 M ${h.x} ${-h.y - 2} v 4"/><text x="${h.x + h.diameter / 2 + 1.5}" y="${-h.y - 2}" style="font-size:${f * 0.85}px">Ø${h.diameter} · ${n + 1}</text></g>`).join("")}<circle cx="0" cy="0" r=".8" class="origin"/><text x="2" y="4" class="origin-text" style="font-size:${f * 0.8}px">0, 0</text>`;
  svg.classList.toggle("placing", placing);
}
function startHole() {
  if (busy) return;
  setMode("sketch");
  placing = true;
  $("#view-hint").textContent =
    "Click inside the rectangle to place a hole center. Escape to cancel.";
  drawSketch();
}
$<SVGSVGElement>("#sketch").addEventListener("click", (e) => {
  if (busy) return;
  const target = e.target as Element;
  const hole = target.closest<SVGElement>("[data-sketch-hole]");
  if (hole && !placing) {
    selected = hole.dataset.sketchHole!;
    render();
    return;
  }
  const dim = target.closest<SVGElement>("[data-dimension]");
  if (dim && !placing) {
    selected = "profile";
    render();
    $<HTMLInputElement>(`[data-field="${dim.dataset.dimension}"]`).focus();
    return;
  }
  if (!placing) return;
  const svg = $<SVGSVGElement>("#sketch");
  const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
    svg.getScreenCTM()!.inverse(),
  );
  const id = crypto.randomUUID();
  const x = Math.round(point.x * 2) / 2,
    y = -Math.round(point.y * 2) / 2;
  void mutate(
    (d) => d.holes.push({ id, x, y, diameter: 6 }),
    "Circle profile added",
  ).then(() => {
    if (model.holes.some((h) => h.id === id)) {
      placing = false;
      selected = id;
      render();
    }
  });
});
async function extrude() {
  if (busy) return;
  selected = "extrude";
  if (!model.extruded)
    await mutate(
      (d) => (d.extruded = true),
      "Extruded one solid with through-hole cuts",
    );
  if (model.extruded) {
    setMode("solid");
    fit();
  } else render();
}
function fit() {
  const size = Math.max(model.width, model.depth, model.thickness) * 2.2;
  controls.target.set(0, 0, model.thickness / 2);
  camera.position
    .copy(controls.target)
    .add(new THREE.Vector3(0.75, -1, 0.85).normalize().multiplyScalar(size));
  camera.updateProjectionMatrix();
  controls.update();
}
function top() {
  if (mode === "sketch") return;
  controls.target.set(0, 0, model.thickness / 2);
  camera.position.set(0, -0.001, Math.max(model.width, model.depth) * 2.5);
  controls.update();
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function filename() {
  return model.name.replace(/[^\w -]/g, "").trim() || "part";
}
async function exportSolid(kind: "step" | "stl") {
  if (!model.extruded) {
    toast("Extrude the sketch before exporting.");
    return;
  }
  if (busy) return;
  try {
    setBusy(true, "Exporting solid…");
    const result = await request("export", { kind });
    download(result.blob, filename() + "." + kind);
    $("#status").textContent =
      `Exported ${kind.toUpperCase()} from the CAD solid`;
  } catch (e) {
    toast((e as Error).message);
  } finally {
    setBusy(false);
  }
}
function modal(title: string, body: string, accept?: () => void) {
  const d = $<HTMLDialogElement>("#dialog");
  d.innerHTML = `<form method="dialog"><div class="dialog-heading"><h2>${title}</h2><button>${i("x")}</button></div>${body}<div class="dialog-footer"><button class="secondary">${accept ? "Cancel" : "Close"}</button>${accept ? '<button type="button" class="dark" id="confirm">Continue</button>' : ""}</div></form>`;
  refreshIcons();
  d.showModal();
  $("#confirm")?.addEventListener("click", () => {
    d.close();
    accept?.();
  });
}
function confirmDiscard(fn: () => void) {
  if (JSON.stringify(model) !== saved)
    modal(
      "Unsaved project",
      "<p>Save your project first to keep a copy. Continuing will replace the current document.</p>",
      fn,
    );
  else fn();
}
async function replace(next: DocumentModel) {
  if (busy) return;
  try {
    next = validateModel(next);
    setBusy(true);
    const data = await request("build", { model: next });
    model = next;
    undo = [];
    redo = [];
    selected = "profile";
    saved = JSON.stringify(model);
    showSolid(data);
    dirty();
    setMode(model.extruded ? "solid" : "sketch");
    fit();
    $("#status").textContent =
      "Project opened and rebuilt from editable features";
  } catch (e) {
    toast((e as Error).message);
  } finally {
    setBusy(false);
  }
}
const on = (id: string, fn: () => void) =>
  $("#" + id).addEventListener("click", fn);
on("edit-sketch", () => {
  selected = "profile";
  setMode("sketch");
});
on("rectangle", () => {
  selected = "profile";
  setMode("sketch");
  $<HTMLInputElement>('[data-field="width"]').focus();
});
on("circle", startHole);
on("extrude", () => {
  selected = "extrude";
  render();
});
on("holes", () => {
  selected = "profile";
  setMode("sketch");
  toast(
    "Add circle profiles, then finish the sketch. Existing solids rebuild with through-cuts.",
  );
});
on("finish-sketch", () => {
  void extrude();
});
on("profile-row", () => {
  selected = "profile";
  setMode("sketch");
});
on("sketch-tab", () => setMode("sketch"));
on("solid-tab", () => {
  if (!model.extruded) {
    selected = "extrude";
    render();
    toast("Create the extrusion to enter solid view.");
  } else setMode("solid");
});
on("home", () => {
  if (model.extruded) setMode("solid");
  fit();
});
on("cube-home", fit);
on("cube-top", top);
on("fit", fit);
on("top", top);
on("grid", () => (grid.visible = !grid.visible));
on("wire", () => {
  wire = !wire;
  solid.children.forEach((c) => {
    if (c instanceof THREE.Mesh)
      (c.material as THREE.MeshStandardMaterial).wireframe = wire;
  });
});
on("export", () => void exportSolid("step"));
on("stl", () => void exportSolid("stl"));
on("save", () => {
  if (busy) return;
  download(
    new Blob([JSON.stringify(model, null, 2)], { type: "application/json" }),
    filename() + ".forma",
  );
  saved = JSON.stringify(model);
  dirty();
  $("#status").textContent = "Editable project downloaded";
});
on("new", () => confirmDiscard(() => void replace(defaultModel())));
on("open", () => confirmDiscard(() => $<HTMLInputElement>("#file").click()));
$<HTMLInputElement>("#file").onchange = async (e) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  try {
    if (f.size > 1_000_000) throw Error("Project file is too large.");
    await replace(validateModel(JSON.parse(await f.text())));
  } catch (err) {
    toast((err as Error).message);
  }
  input.value = "";
};
$<HTMLInputElement>("#title").onchange = (e) => {
  const name = (e.target as HTMLInputElement).value.trim();
  if (!name) {
    render();
    return;
  }
  void mutate((d) => (d.name = name), "Project renamed");
};
$("#timeline").addEventListener("click", (e) => {
  const feature = (e.target as Element).closest<HTMLElement>("[data-feature]")
    ?.dataset.feature;
  if (feature) {
    selected = feature === "holes" ? "profile" : feature;
    setMode(feature === "extrude" ? "solid" : "sketch");
  }
});
async function travel(from: DocumentModel[], to: DocumentModel[]) {
  if (busy || !from.length) return;
  try {
    const next = from[from.length - 1];
    setBusy(true);
    const data = await request("build", { model: next });
    to.push(structuredClone(model));
    from.pop();
    model = structuredClone(next);
    selected = "profile";
    showSolid(data);
    if (!model.extruded) mode = "sketch";
    dirty();
    render();
    $("#status").textContent = "Feature history rebuilt";
  } catch (e) {
    toast((e as Error).message);
  } finally {
    setBusy(false);
  }
}
on("undo", () => void travel(undo, redo));
on("redo", () => void travel(redo, undo));
on("help", () =>
  modal(
    "Solid part design",
    "<p>1. Set the rectangle width and depth.<br>2. Finish sketch and set the extrusion thickness.<br>3. Edit Sketch 1, choose Hole profile, and click to place a circle.<br>4. Edit its diameter and center coordinates. The kernel cuts it through the plate.</p><p>Save project downloads an editable .forma file. Open rebuilds that file from its dimensions. STEP exports the actual boundary-representation solid; STL exports its tessellation.</p><p>This build supports one rectangular part with circular through-holes. Freeform sketch constraints, fillets, assemblies, and STEP import remain future work.</p>",
  ),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    placing = false;
    render();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (!busy) $("#save").click();
  }
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key === "z" &&
    !(e.target instanceof HTMLInputElement)
  ) {
    e.preventDefault();
    void travel(e.shiftKey ? redo : undo, e.shiftKey ? undo : redo);
  }
});
window.addEventListener("beforeunload", (e) => {
  if (JSON.stringify(model) !== saved) {
    e.preventDefault();
    e.returnValue = "";
  }
});
new ResizeObserver(() => {
  const r = $("#canvas").getBoundingClientRect();
  if (r.width && r.height) {
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height);
  }
}).observe($(".viewport"));
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
render();
setBusy(true, "Loading OpenCascade geometry kernel…");
request("init")
  .then(async () => {
    $("#kernel-dot").classList.add("ready");
    $("#kernel-status").textContent =
      "Ready · real boundary-representation solids";
    $("#status").textContent = "Kernel ready · create a dimensioned sketch";
    try {
      const recovery = localStorage.getItem("forma-solid-v1");
      if (recovery) {
        const d = validateModel(JSON.parse(recovery));
        setBusy(false);
        await replace(d);
        $("#save-state").textContent = "Recovered from browser";
      }
    } catch {
      toast("Recovery data was invalid. Starting a new part.");
    } finally {
      setBusy(false);
    }
  })
  .catch((e) => {
    setBusy(false);
    $("#kernel-status").textContent = "Failed to load";
    $("#status").textContent = "Kernel unavailable";
    toast((e as Error).message);
  });
