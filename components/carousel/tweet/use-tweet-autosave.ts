"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TweetCard, TweetProfileSnapshot, TweetTheme } from "@/types/tweet-carousel";

export type TweetDraft = {
  name: string;
  theme: TweetTheme;
  cards: TweetCard[];
  profileId: string | null;
  profile: TweetProfileSnapshot;
};

export type SaveStatus = "saved" | "pending" | "saving" | "offline";

type LocalEntry = { draft: TweetDraft; editedAt: number; synced: boolean };

const DEBOUNCE_MS = 700;
const RETRY_MS = 5000;

function storageKey(id: string) {
  return `tweet-carousel:${id}`;
}

function readLocal(id: string): LocalEntry | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as LocalEntry) : null;
  } catch {
    return null;
  }
}

function writeLocal(id: string, entry: LocalEntry) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(entry));
  } catch {
    /* storage cheio/bloqueado: o servidor continua sendo a fonte */
  }
}

/**
 * Autosave em duas camadas: cópia local imediata (sobrevive a fechar a aba ou
 * cair a conexão) + PUT com debounce no servidor, com retry e flush com
 * `keepalive` quando a página é escondida.
 */
export function useTweetAutosave(id: string, initial: TweetDraft, serverUpdatedAt: string) {
  const [draft, setDraft] = useState<TweetDraft>(initial);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [restored, setRestored] = useState(false);
  const latest = useRef(draft);
  const dirty = useRef(false);
  const editedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  const push = useCallback(
    async (keepalive = false) => {
      if (!dirty.current || (inflight.current && !keepalive)) return;
      inflight.current = true;
      const sentAt = editedAt.current;
      const payload = latest.current;
      setStatus("saving");
      try {
        const res = await fetch(`/api/carousel/tweet/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive,
        });
        if (!res.ok) throw new Error(String(res.status));
        // Só limpa se nada mudou enquanto o request estava no ar.
        if (editedAt.current === sentAt) {
          dirty.current = false;
          writeLocal(id, { draft: payload, editedAt: sentAt, synced: true });
          setStatus("saved");
        } else {
          setStatus("pending");
        }
      } catch {
        setStatus("offline");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => push(), RETRY_MS);
        return;
      } finally {
        inflight.current = false;
      }
      if (dirty.current) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => push(), DEBOUNCE_MS);
      }
    },
    [id]
  );

  const update = useCallback(
    (fn: (d: TweetDraft) => TweetDraft) => {
      setDraft((prev) => {
        const next = fn(prev);
        latest.current = next;
        dirty.current = true;
        editedAt.current = Date.now();
        writeLocal(id, { draft: next, editedAt: editedAt.current, synced: false });
        return next;
      });
      setStatus((s) => (s === "offline" ? s : "pending"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => push(), DEBOUNCE_MS);
    },
    [id, push]
  );

  // Recupera edições locais que não chegaram ao servidor (aba fechada, erro, offline).
  useEffect(() => {
    const local = readLocal(id);
    if (local && !local.synced && local.editedAt > new Date(serverUpdatedAt).getTime()) {
      latest.current = local.draft;
      dirty.current = true;
      editedAt.current = local.editedAt;
      setDraft(local.draft);
      setRestored(true);
      push();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current) push(true);
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    const onOnline = () => dirty.current && push();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      flush();
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
      // Navegação interna (SPA): garante o envio do que ficou pendente.
      if (dirty.current) push(true);
    };
  }, [push]);

  return { draft, update, status, restored };
}
