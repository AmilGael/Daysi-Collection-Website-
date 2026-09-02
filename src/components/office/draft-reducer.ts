import type { ChangeResult } from "@/lib/action-guard";

export type DraftEntry<Change> = {
  readonly key: string;
  readonly change: Change;
  readonly error?: string;
  readonly count?: number;
};
export type DraftStatus = "idle" | "confirming" | "failed";
export type DraftState<Change> = {
  readonly entries: readonly DraftEntry<Change>[];
  readonly status: DraftStatus;
  readonly error?: string;
};
export type DraftAction<Change> =
  | { type: "stage"; key: string; change: Change }
  | { type: "unstage"; key: string }
  | { type: "discard" }
  | { type: "confirming" }
  | { type: "settled"; results: readonly ChangeResult[] }
  | { type: "refused"; error: string };

export const emptyDraft: DraftState<never> = { entries: [], status: "idle" };

export function draftReducer<Change>(
  state: DraftState<Change>,
  action: DraftAction<Change>,
): DraftState<Change> {
  switch (action.type) {
    case "stage": {
      const index = state.entries.findIndex((entry) => entry.key === action.key);
      const entry = { key: action.key, change: action.change };
      const entries =
        index === -1
          ? [...state.entries, entry]
          : state.entries.map((current, currentIndex) => (currentIndex === index ? entry : current));
      return { entries, status: "idle" };
    }
    case "unstage":
      return { entries: state.entries.filter((entry) => entry.key !== action.key), status: "idle" };
    case "discard":
      return emptyDraft;
    case "confirming":
      return { entries: state.entries, status: "confirming" };
    case "settled": {
      const results = new Map(action.results.map((result) => [result.key, result]));
      const entries = state.entries.flatMap((entry) => {
        const result = results.get(entry.key);
        if (result?.ok) return [];
        return [{ ...entry, error: result?.error ?? "failed", count: result?.count }];
      });
      return entries.length === 0 ? emptyDraft : { entries, status: "failed" };
    }
    case "refused":
      return { entries: state.entries, status: "failed", error: action.error };
  }
}

export function pendingIn<Change>(
  state: DraftState<Change>,
  key: string,
): DraftEntry<Change> | undefined {
  return state.entries.find((entry) => entry.key === key);
}
