"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useOptimistic,
  useReducer,
  useTransition,
  type JSX,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import type { ActionResult, ChangeResult } from "@/lib/action-guard";
import { uploadPhoto } from "@/components/office-client";
import { ConfirmBar } from "./confirm-bar";
import {
  draftReducer,
  emptyDraft,
  pendingIn,
  type DraftEntry,
  type DraftStatus,
} from "./draft-reducer";

export type DraftChange<Wire> = {
  readonly wire: Wire;
  readonly files?: readonly File[];
  readonly withUploads?: (srcs: readonly string[]) => Wire;
};
export type ApplyChanges<Wire> = (
  changes: Wire[],
) => Promise<ActionResult<{ results: ChangeResult[] }>>;

type DraftContextValue<Wire> = {
  stage(key: string, change: DraftChange<Wire>): void;
  unstage(key: string): void;
  discard(): void;
  confirm(): void;
  pending(key: string): (DraftEntry<DraftChange<Wire>> & { confirming: boolean }) | undefined;
  readonly entries: readonly DraftEntry<DraftChange<Wire>>[];
  readonly count: number;
  readonly status: DraftStatus;
  readonly error?: string;
};

const EMPTY: ReadonlySet<string> = new Set();
const DraftContext = createContext<DraftContextValue<unknown> | null>(null);

export function OfficeDraftProvider<Wire>({
  apply,
  children,
}: {
  apply: ApplyChanges<Wire>;
  children: ReactNode;
}): JSX.Element {
  const t = useTranslations("office");
  const [state, dispatch] = useReducer(draftReducer<DraftChange<Wire>>, emptyDraft);
  const [confirming, markConfirming] = useOptimistic<ReadonlySet<string>, readonly string[]>(
    EMPTY,
    (_, keys) => new Set(keys),
  );
  const [, startTransition] = useTransition();
  const count = state.entries.length;

  const stage = useCallback((key: string, change: DraftChange<Wire>) => {
    dispatch({ type: "stage", key, change });
  }, []);
  const unstage = useCallback((key: string) => dispatch({ type: "unstage", key }), []);
  const discard = useCallback(() => dispatch({ type: "discard" }), []);

  const confirm = useCallback(() => {
    const entries = state.entries;
    const keys = entries.map((entry) => entry.key);
    if (keys.length === 0) return;

    startTransition(async () => {
      dispatch({ type: "confirming" });
      markConfirming(keys);
      const wires: Wire[] = [];
      const uploadFailures: ChangeResult[] = [];

      for (const entry of entries) {
        try {
          const srcs = entry.change.files
            ? await Promise.all(entry.change.files.map(uploadPhoto))
            : [];
          wires.push(
            entry.change.files && entry.change.withUploads
              ? entry.change.withUploads(srcs)
              : entry.change.wire,
          );
        } catch {
          uploadFailures.push({ key: entry.key, ok: false, error: "upload-failed" });
        }
      }

      const result =
        wires.length > 0 ? await apply(wires) : { ok: true as const, results: [] };
      startTransition(() =>
        dispatch(
          result.ok
            ? { type: "settled", results: [...result.results, ...uploadFailures] }
            : { type: "refused", error: result.error },
        ),
      );
    });
  }, [apply, markConfirming, startTransition, state.entries]);

  useEffect(() => {
    if (count === 0) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank") return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      if (!window.confirm(t("leaveUnconfirmed"))) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [count, t]);

  const value: DraftContextValue<Wire> = {
    stage,
    unstage,
    discard,
    confirm,
    pending(key) {
      const entry = pendingIn(state, key);
      return entry ? { ...entry, confirming: confirming.has(key) } : undefined;
    },
    entries: state.entries,
    count,
    status: state.status,
    error: state.error,
  };

  return (
    <DraftContext.Provider value={value as DraftContextValue<unknown>}>
      {children}
      <ConfirmBar
        count={count}
        status={state.status}
        error={state.error}
        onConfirm={confirm}
        onDiscard={discard}
      />
    </DraftContext.Provider>
  );
}

export function useOfficeDraft<Wire>(): DraftContextValue<Wire> {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useOfficeDraft must be used inside OfficeDraftProvider");
  return context as DraftContextValue<Wire>;
}
