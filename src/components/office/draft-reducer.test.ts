import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  draftReducer,
  emptyDraft,
  pendingIn,
  type DraftState,
} from "./draft-reducer";

type Change = { value: string };

const stage = (state: DraftState<Change>, key: string, value: string) =>
  draftReducer(state, { type: "stage", key, change: { value } });

describe("office draft reducer", () => {
  it("stages entries by appending them", () => {
    const one = stage(emptyDraft, "style:one", "first");
    const two = stage(one, "style:two", "second");

    expect(two.entries).toHaveLength(2);
    expect(two.entries.map((entry) => entry.key)).toEqual(["style:one", "style:two"]);
  });

  it("restages in place and keeps the existing order", () => {
    const state = stage(stage(emptyDraft, "style:one", "first"), "style:two", "second");
    const restaged = stage(state, "style:one", "replacement");

    expect(restaged.entries).toEqual([
      { key: "style:one", change: { value: "replacement" } },
      { key: "style:two", change: { value: "second" } },
    ]);
  });

  it("unstages only the named key", () => {
    const state = stage(stage(emptyDraft, "style:one", "first"), "style:two", "second");
    expect(draftReducer(state, { type: "unstage", key: "style:one" }).entries).toEqual([
      { key: "style:two", change: { value: "second" } },
    ]);
  });

  it("discards every entry and clears status", () => {
    const state = draftReducer(stage(emptyDraft, "style:one", "first"), {
      type: "refused",
      error: "invalid",
    });
    expect(draftReducer(state, { type: "discard" })).toEqual(emptyDraft);
  });

  it("settles successful keys and keeps failed keys with their reason", () => {
    const state = stage(stage(emptyDraft, "style:one", "first"), "style:two", "second");
    const settled = draftReducer(state, {
      type: "settled",
      keys: ["style:one", "style:two"],
      results: [
        { key: "style:one", ok: true },
        { key: "style:two", ok: false, error: "in-use", count: 3 },
      ],
    });

    expect(settled).toEqual({
      entries: [{ key: "style:two", change: { value: "second" }, error: "in-use", count: 3 }],
      status: "failed",
    });
  });

  it("marks a missing result as failed", () => {
    const settled = draftReducer(stage(emptyDraft, "style:one", "first"), {
      type: "settled",
      keys: ["style:one"],
      results: [],
    });
    expect(settled.entries[0]?.error).toBe("failed");
  });

  it("returns to idle when every key settles successfully", () => {
    const settled = draftReducer(stage(emptyDraft, "style:one", "first"), {
      type: "settled",
      keys: ["style:one"],
      results: [{ key: "style:one", ok: true }],
    });
    expect(settled).toEqual(emptyDraft);
  });

  it("keeps entries and records a refused action error", () => {
    const state = stage(emptyDraft, "style:one", "first");
    expect(draftReducer(state, { type: "refused", error: "bad-origin" })).toEqual({
      entries: state.entries,
      status: "failed",
      error: "bad-origin",
    });
  });

  it("clears a failed entry error when that key is staged again", () => {
    const failed = draftReducer(stage(emptyDraft, "style:one", "first"), {
      type: "settled",
      keys: ["style:one"],
      results: [{ key: "style:one", ok: false, error: "failed" }],
    });
    expect(stage(failed, "style:one", "fixed").entries[0]?.error).toBeUndefined();
  });

  it("leaves a key staged during the confirm alone", () => {
    const state = stage(stage(emptyDraft, "style:one", "first"), "style:two", "second");
    const settled = draftReducer(state, {
      type: "settled",
      keys: ["style:one"],
      results: [{ key: "style:one", ok: true }],
    });
    expect(settled).toEqual({ entries: [{ key: "style:two", change: { value: "second" } }], status: "idle" });
  });

  it("keeps a failed sent key and an untouched key side by side", () => {
    const state = stage(stage(emptyDraft, "style:one", "first"), "style:two", "second");
    const settled = draftReducer(state, {
      type: "settled",
      keys: ["style:one"],
      results: [{ key: "style:one", ok: false, error: "in-use", count: 2 }],
    });
    expect(settled.status).toBe("failed");
    expect(settled.entries).toEqual([
      { key: "style:one", change: { value: "first" }, error: "in-use", count: 2 },
      { key: "style:two", change: { value: "second" } },
    ]);
  });

  it("is told which keys the provider sent, not just their results", () => {
    const provider = readFileSync(path.join(process.cwd(), "src/components/office/use-office-draft.tsx"), "utf8");
    expect(provider).toContain('{ type: "settled", keys, results:');
  });

  it("finds a pending entry by key", () => {
    const state = stage(emptyDraft, "style:one", "first");
    expect(pendingIn(state, "style:one")).toEqual(state.entries[0]);
    expect(pendingIn(state, "style:missing")).toBeUndefined();
  });
});

describe("office draft messages", () => {
  it("has the draft keys in both languages and no em dashes", () => {
    const keys = [
      "pendingMark",
      "changesPending",
      "confirmChanges",
      "confirming",
      "discardChanges",
      "leaveUnconfirmed",
      "removePending",
      "undo",
      "undoPending",
      "retire",
      "restore",
      "retiredGroup",
      "retireRequestConfirm",
    ] as const;

    for (const bundle of [es, en]) {
      for (const key of keys) {
        expect(bundle.office[key], `${key} exists`).toBeTruthy();
      }
      expect(JSON.stringify(bundle.office)).not.toContain("—");
    }
  });
});
