import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const ready = async (page: any) => {
  await page.goto("/");
  await expect(page.locator("#kernel-status")).toContainText("Ready", {
    timeout: 60000,
  });
  await expect(page.locator("#loading")).not.toBeVisible({ timeout: 60000 });
};
const volume = async (page: any) =>
  Number(
    (await page.locator("#volume").textContent())
      .split(" mm")[0]
      .replaceAll(",", ""),
  );
async function field(page: any, name: string, value: string) {
  await page.getByRole("spinbutton", { name, exact: true }).fill(value);
  await page.getByRole("spinbutton", { name, exact: true }).press("Tab");
  await expect(page.locator("#loading")).not.toBeVisible({ timeout: 30000 });
}
test("real B-rep extrusion, through-cut volume, editable save/reopen, STEP and STL", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await field(page, "Width", "120");
  await field(page, "Depth", "80");
  await page.locator("#finish-sketch").click();
  await expect(page.locator("#volume")).toContainText("1 solid", {
    timeout: 30000,
  });
  expect(await volume(page)).toBeCloseTo(120 * 80 * 8, 1);
  await field(page, "Thickness", "10");
  expect(await volume(page)).toBeCloseTo(96000, 1);
  await page.locator("#edit-sketch").click();
  await page.locator("#circle").click();
  const point = await page.locator("#sketch").evaluate((svg: SVGSVGElement) => {
    const p = new DOMPoint(25, 15).matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole("spinbutton", { name: "Diameter", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await field(page, "Diameter", "12");
  expect(await volume(page)).toBeCloseTo(96000 - Math.PI * 36 * 10, 1);
  await page.locator("#finish-sketch").click();
  await expect(page.locator("#canvas")).toBeVisible();
  const stepDownload = page.waitForEvent("download");
  await page.locator("#export").click();
  const step = await stepDownload;
  const stepText = await readFile((await step.path())!, "utf8");
  expect(stepText).toContain("ISO-10303-21");
  expect(stepText).toContain("MANIFOLD_SOLID_BREP");
  const stlDownload = page.waitForEvent("download");
  await page.locator("#stl").click();
  const stl = await stlDownload;
  expect((await readFile((await stl.path())!)).length).toBeGreaterThan(100);
  const projectDownload = page.waitForEvent("download");
  await page.locator("#save").click();
  const project = await projectDownload;
  const file = await readFile((await project.path())!);
  const doc = JSON.parse(file.toString());
  expect(doc.width).toBe(120);
  expect(doc.thickness).toBe(10);
  expect(doc.holes[0].diameter).toBe(12);
  await page.locator("#new").click();
  await expect(page.locator("#volume")).toContainText("No solid");
  await page
    .locator("#file")
    .setInputFiles({
      name: "plate.forma",
      mimeType: "application/json",
      buffer: file,
    });
  await expect(page.locator("#volume")).toContainText("1 solid", {
    timeout: 30000,
  });
  expect(await volume(page)).toBeCloseTo(96000 - Math.PI * 36 * 10, 1);
  await page.locator("#edit-sketch").click();
  await field(page, "Width", "140");
  expect(await volume(page)).toBeCloseTo(112000 - Math.PI * 36 * 10, 1);
  await page.locator("#undo").click();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("120");
  expect(await volume(page)).toBeCloseTo(96000 - Math.PI * 36 * 10, 1);
  await page.locator("#redo").click();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("140");
  await page.locator("#finish-sketch").click();
  await page.screenshot({ path: "/tmp/forma-solid.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("rejects invalid dimensions and project files without losing the solid", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#finish-sketch").click();
  await expect(page.locator("#volume")).toContainText("1 solid", {
    timeout: 30000,
  });
  await page.locator("#edit-sketch").click();
  await field(page, "Width", "-5");
  await expect(page.locator("#toast")).toContainText("Dimensions must");
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("100");
  expect(await volume(page)).toBe(56000);
  await page
    .locator("#file")
    .setInputFiles({
      name: "broken.forma",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"wrong"}'),
    });
  await expect(page.locator("#toast")).toContainText("Not a supported");
  expect(await volume(page)).toBe(56000);
});
