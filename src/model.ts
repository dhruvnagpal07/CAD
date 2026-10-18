export type Hole = { id: string; x: number; y: number; diameter: number };
export type DocumentModel = {
  format: "forma-solid";
  version: 1;
  name: string;
  width: number;
  depth: number;
  thickness: number;
  extruded: boolean;
  holes: Hole[];
};
export const defaultModel = (): DocumentModel => ({
  format: "forma-solid",
  version: 1,
  name: "Mounting plate",
  width: 100,
  depth: 70,
  thickness: 8,
  extruded: false,
  holes: [],
});
export function validateModel(input: unknown): DocumentModel {
  const d = input as DocumentModel;
  if (
    !d ||
    d.format !== "forma-solid" ||
    d.version !== 1 ||
    typeof d.name !== "string" ||
    d.name.length > 120 ||
    typeof d.extruded !== "boolean" ||
    !Array.isArray(d.holes) ||
    d.holes.length > 40
  )
    throw Error("Not a supported Forma solid project.");
  for (const key of ["width", "depth", "thickness"] as const)
    if (!Number.isFinite(d[key]) || d[key] < 0.1 || d[key] > 2000)
      throw Error("Dimensions must be between 0.1 and 2000 mm.");
  const ids = new Set<string>();
  for (const h of d.holes) {
    if (
      typeof h.id !== "string" ||
      ids.has(h.id) ||
      ![h.x, h.y, h.diameter].every(Number.isFinite) ||
      h.diameter < 0.1
    )
      throw Error("Invalid hole dimensions.");
    ids.add(h.id);
    if (
      Math.abs(h.x) + h.diameter / 2 >= d.width / 2 ||
      Math.abs(h.y) + h.diameter / 2 >= d.depth / 2
    )
      throw Error("Each hole must fit fully inside the plate.");
  }
  for (let i = 0; i < d.holes.length; i++)
    for (let j = i + 1; j < d.holes.length; j++) {
      const a = d.holes[i],
        b = d.holes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= (a.diameter + b.diameter) / 2)
        throw Error("Hole profiles must not overlap or touch.");
    }
  return structuredClone(d);
}
