import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const state = vi.hoisted(() => ({ requestHeaders: new Headers() }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => state.requestHeaders) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn() }));

import { revalidatePath } from "next/cache";
import { currentViewer } from "@/lib/auth/session";
import { applyEach, ChangeRefused, ownerAction } from "./action-guard";

const viewer = vi.mocked(currentViewer);
const revalidate = vi.mocked(revalidatePath);

beforeEach(() => {
  vi.clearAllMocks();
  state.requestHeaders = new Headers({ origin: "https://shop.test", host: "shop.test" });
});

describe("ownerAction", () => {
  const schema = z.object({ name: z.string(), count: z.number().default(2) });

  it("refuses cross-origin input before consulting the viewer", async () => {
    state.requestHeaders = new Headers({ origin: "https://evil.test", host: "shop.test" });
    const handle = vi.fn();
    const action = ownerAction(schema, handle, { revalidate: [] });

    await expect(action({ name: "dress" })).resolves.toEqual({ ok: false, error: "bad-origin" });
    expect(viewer).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it("hides the action from a client", async () => {
    viewer.mockResolvedValue({ role: "client" } as Awaited<ReturnType<typeof currentViewer>>);
    const handle = vi.fn();
    const action = ownerAction(schema, handle, { revalidate: [] });

    await expect(action({ name: "dress" })).resolves.toEqual({ ok: false, error: "not-found" });
    expect(handle).not.toHaveBeenCalled();
  });

  it("refuses a bad body from the owner", async () => {
    viewer.mockResolvedValue({ role: "owner" } as Awaited<ReturnType<typeof currentViewer>>);
    const handle = vi.fn();
    const action = ownerAction(schema, handle, { revalidate: [] });

    await expect(action({ name: 3 })).resolves.toEqual({ ok: false, error: "invalid" });
    expect(handle).not.toHaveBeenCalled();
  });

  it("passes parsed defaults, spreads the result and revalidates every path", async () => {
    viewer.mockResolvedValue({ role: "owner" } as Awaited<ReturnType<typeof currentViewer>>);
    const handle = vi.fn(async () => ({ saved: "yes" }));
    const action = ownerAction(schema, handle, {
      revalidate: ["/office", ["/shop", "layout"]],
    });

    await expect(action({ name: "dress" })).resolves.toEqual({ ok: true, saved: "yes" });
    expect(handle).toHaveBeenCalledWith({ name: "dress", count: 2 });
    expect(revalidate).toHaveBeenNthCalledWith(1, "/office", "page");
    expect(revalidate).toHaveBeenNthCalledWith(2, "/shop", "layout");
  });

  it("returns failed and does not revalidate when the handler throws", async () => {
    viewer.mockResolvedValue({ role: "owner" } as Awaited<ReturnType<typeof currentViewer>>);
    const action = ownerAction(schema, async () => {
      throw new Error("disk");
    }, { revalidate: ["/office"] });

    await expect(action({ name: "dress" })).resolves.toEqual({ ok: false, error: "failed" });
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("applyEach", () => {
  it("keeps order, preserves refusal codes and continues after failures", async () => {
    const visited: string[] = [];
    const changes = [{ key: "first" }, { key: "second" }, { key: "third" }];
    const result = await applyEach(changes, async ({ key }) => {
      visited.push(key);
      if (key === "first") throw new ChangeRefused("in-use", 3);
      if (key === "second") throw new Error("disk");
    });

    expect(visited).toEqual(["first", "second", "third"]);
    expect(result.results).toEqual([
      { key: "first", ok: false, error: "in-use", count: 3 },
      { key: "second", ok: false, error: "failed" },
      { key: "third", ok: true },
    ]);
  });

  it("omits count when a refusal does not carry one", async () => {
    const result = await applyEach([{ key: "first" }], async () => {
      throw new ChangeRefused("unknown-style");
    });

    expect(result.results).toEqual([
      { key: "first", ok: false, error: "unknown-style" },
    ]);
    expect(result.results[0]).not.toHaveProperty("count");
  });
});

describe("office action structure", () => {
  it("keeps exactly one ownerAction in every editable tab", () => {
    const officeRoot = path.join(process.cwd(), "src/app/[locale]/office");
    const serverFiles = fs.existsSync(officeRoot)
      ? fs.readdirSync(officeRoot, { recursive: true, encoding: "utf8" })
          .map((name) => ({ name, path: path.join(officeRoot, name) }))
          .filter(({ path: filePath }) => fs.statSync(filePath).isFile())
          .filter(({ path: filePath }) => fs.readFileSync(filePath, "utf8").includes('"use server"'))
      : [];

    expect(serverFiles.map(({ name }) => name).sort()).toEqual([
      "actions.ts",
      "collection/actions.ts",
      "fabrics/actions.ts",
      "gallery/actions.ts",
      "prices/actions.ts",
      "shopfront/actions.ts",
      "work/actions.ts",
    ]);

    const expectedExports: Record<string, string> = {
      ".": "readPreviousChange",
      collection: "applyCollectionChanges",
      fabrics: "applyFabricChanges",
      gallery: "applyGalleryChanges",
      prices: "applyPriceChanges",
      shopfront: "applyShopfrontChanges",
      work: "applyWorkChanges",
    };

    for (const file of serverFiles) {
      const source = fs.readFileSync(file.path, "utf8");
      const firstCodeLine = source
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith("//") && !line.startsWith("/*"));
      expect(firstCodeLine, file.path).toBe('"use server";');
      expect(source, file.path).toContain("@/lib/action-guard");
      expect(source.match(/^export .*$/gm) ?? [], file.path).toEqual([
        `export const ${expectedExports[path.dirname(file.name)]} = ownerAction(`,
      ]);
      expect(source, file.path).not.toMatch(/export async function|isSameOrigin|bad-origin|currentViewer\(|role !==/);
    }
  });
});
