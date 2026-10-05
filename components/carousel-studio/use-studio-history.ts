"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";
import type { StudioDocument } from "@/types/carousel-studio";

/**
 * Estado do documento com desfazer/refazer.
 *
 * - `commit(fn, key?)`: mudança com histórico. Commits com a mesma `key` em
 *   sequência rápida (arrastar um slider, digitar num campo) viram UM passo.
 * - `beginGesture` / `preview` / `endGesture`: arrastar/redimensionar no canvas
 *   — atualiza a tela a cada frame e grava um único passo ao soltar.
 * - `replace(doc)`: troca o documento sem histórico (Realtime da geração).
 */

const MAX_HISTORY = 120;
const COALESCE_MS = 900;

type State = {
  doc: StudioDocument;
  past: StudioDocument[];
  future: StudioDocument[];
  /** Incrementa a cada mudança real — dispara o autosave. */
  revision: number;
};

type Action =
  | { type: "commit"; fn: (doc: StudioDocument) => StudioDocument; coalesce: boolean }
  | { type: "preview"; fn: (doc: StudioDocument) => StudioDocument }
  | { type: "endGesture"; base: StudioDocument }
  | { type: "replace"; doc: StudioDocument; keepHistory: boolean }
  | { type: "undo" }
  | { type: "redo" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "commit": {
      const next = action.fn(state.doc);
      if (next === state.doc) return state;
      const past = action.coalesce && state.past.length > 0 ? state.past : [...state.past, state.doc].slice(-MAX_HISTORY);
      return { doc: next, past, future: [], revision: state.revision + 1 };
    }
    case "preview": {
      const next = action.fn(state.doc);
      return next === state.doc ? state : { ...state, doc: next };
    }
    case "endGesture": {
      if (action.base === state.doc) return state;
      return {
        doc: state.doc,
        past: [...state.past, action.base].slice(-MAX_HISTORY),
        future: [],
        revision: state.revision + 1,
      };
    }
    case "replace":
      return {
        doc: action.doc,
        past: action.keepHistory ? state.past : [],
        future: action.keepHistory ? state.future : [],
        revision: state.revision,
      };
    case "undo": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { doc: prev, past: state.past.slice(0, -1), future: [state.doc, ...state.future], revision: state.revision + 1 };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { doc: next, past: [...state.past, state.doc], future: rest, revision: state.revision + 1 };
    }
  }
}

export function useStudioHistory(initial: StudioDocument) {
  const [state, dispatch] = useReducer(reducer, { doc: initial, past: [], future: [], revision: 0 });
  const gestureBase = useRef<StudioDocument | null>(null);
  const docRef = useRef(state.doc);
  docRef.current = state.doc;
  const lastCommit = useRef<{ key: string; at: number } | null>(null);

  const commit = useCallback((fn: (doc: StudioDocument) => StudioDocument, key?: string) => {
    const now = Date.now();
    const coalesce = Boolean(key && lastCommit.current?.key === key && now - lastCommit.current.at < COALESCE_MS);
    lastCommit.current = key ? { key, at: now } : null;
    dispatch({ type: "commit", fn, coalesce });
  }, []);

  const beginGesture = useCallback(() => {
    gestureBase.current = docRef.current;
    lastCommit.current = null;
  }, []);

  const preview = useCallback((fn: (doc: StudioDocument) => StudioDocument) => {
    dispatch({ type: "preview", fn });
  }, []);

  const endGesture = useCallback(() => {
    const base = gestureBase.current;
    gestureBase.current = null;
    if (base) dispatch({ type: "endGesture", base });
  }, []);

  const replace = useCallback((doc: StudioDocument, keepHistory = false) => {
    dispatch({ type: "replace", doc, keepHistory });
  }, []);

  const undo = useCallback(() => {
    lastCommit.current = null;
    dispatch({ type: "undo" });
  }, []);
  const redo = useCallback(() => {
    lastCommit.current = null;
    dispatch({ type: "redo" });
  }, []);

  return useMemo(
    () => ({
      doc: state.doc,
      revision: state.revision,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      commit,
      beginGesture,
      preview,
      endGesture,
      replace,
      undo,
      redo,
      docRef,
    }),
    [state, commit, beginGesture, preview, endGesture, replace, undo, redo]
  );
}

export type StudioHistory = ReturnType<typeof useStudioHistory>;
