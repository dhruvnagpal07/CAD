import init from "replicad-opencascadejs";
import wasm from "replicad-opencascadejs/wasm?url";
import {
  setOC,
  sketchRectangle,
  sketchCircle,
  measureVolume,
  type Shape3D,
} from "replicad";
import { validateModel, type DocumentModel } from "./model";
let shape: Shape3D | undefined;
const ready = init({ locateFile: () => wasm }).then((oc) => setOC(oc));
async function build(d: DocumentModel) {
  let next = sketchRectangle(d.width, d.depth).extrude(d.thickness);
  try {
    for (const h of d.holes) {
      const tool = sketchCircle(h.diameter / 2, {
        origin: [h.x, h.y, -1],
      }).extrude(d.thickness + 2);
      try {
        const cut = next.cut(tool);
        next.delete();
        next = cut;
      } finally {
        tool.delete();
      }
    }
    const mesh = next.mesh({ tolerance: 0.08, angularTolerance: 0.15 });
    const lines = next.meshEdges({ tolerance: 0.08 }).lines;
    const volume = measureVolume(next);
    const solids = next.solids;
    const count = solids.length;
    solids.forEach((s) => s.delete());
    if (count !== 1 || !Number.isFinite(volume) || volume <= 0)
      throw Error("Kernel did not produce one valid solid.");
    shape?.delete();
    shape = next;
    return { mesh, lines, volume };
  } catch (e) {
    next.delete();
    throw e;
  }
}
self.onmessage = async ({ data }) => {
  const { id, action, model } = data;
  try {
    await ready;
    if (action === "build") {
      const d = validateModel(model);
      if (!d.extruded) {
        shape?.delete();
        shape = undefined;
        self.postMessage({ id, ok: true, sketch: true });
        return;
      }
      const result = await build(d);
      self.postMessage({ id, ok: true, ...result });
    } else if (action === "export") {
      if (!shape) throw Error("Extrude the sketch first.");
      const blob = data.kind === "step" ? shape.blobSTEP() : shape.blobSTL();
      self.postMessage({ id, ok: true, blob });
    } else self.postMessage({ id, ok: true });
  } catch (e) {
    self.postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
