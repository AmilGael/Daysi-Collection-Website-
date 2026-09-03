import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readAverageColor, readImageSize } from "./image-reads";

const file = () => new File([new Uint8Array(4)], "swatch.jpg", { type: "image/jpeg" });

afterEach(() => vi.unstubAllGlobals());

describe("image reads", () => {
  it("reads an image size and closes the bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => ({ width: 3, height: 4, close }));

    await expect(readImageSize(file())).resolves.toEqual({ width: 3, height: 4 });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns undefined when an image size cannot be read", async () => {
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("not an image");
    });

    await expect(readImageSize(file())).resolves.toBeUndefined();
  });

  it("reads the average image colour", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ close: vi.fn() }));
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(400).fill(0x80) }),
      }),
    };
    vi.stubGlobal("document", { createElement: () => canvas });

    await expect(readAverageColor(file())).resolves.toBe("#808080");
  });

  it("uses the default colour without a 2d context", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ close: vi.fn() }));
    vi.stubGlobal("document", {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });

    await expect(readAverageColor(file())).resolves.toBe("#8e8471");
  });

  it("returns undefined when an average colour cannot be read", async () => {
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("not an image");
    });

    await expect(readAverageColor(file())).resolves.toBeUndefined();
  });
});

describe("the add forms", () => {
  it.each(["gallery-manager.tsx", "fabric-manager.tsx"])(
    "%s reports an unreadable upload",
    (name) => {
      const source = fs.readFileSync(path.join(process.cwd(), "src/components", name), "utf8");
      expect(source).toContain('from "./office/image-reads"');
      expect(source).toContain('"upload-failed"');
      expect(source).toContain("<ErrorText");
      expect(source).not.toContain("createImageBitmap(");
    },
  );
});
