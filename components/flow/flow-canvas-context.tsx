"use client";

import { createContext, useContext } from "react";

type FlowCanvasContextValue = {
  scheduleAutoSave: () => void;
  /** Salva já (cancela o debounce). Resolve `true` se salvou. */
  saveNow: () => Promise<boolean>;
};

export const FlowCanvasContext = createContext<FlowCanvasContextValue>({
  scheduleAutoSave: () => {},
  saveNow: async () => false,
});

export function useFlowCanvas() {
  return useContext(FlowCanvasContext);
}
