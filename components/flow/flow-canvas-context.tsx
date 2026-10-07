"use client";

import { createContext, useContext } from "react";

type FlowCanvasContextValue = {
  scheduleAutoSave: () => void;
  /** Salva já (cancela o debounce). Resolve `true` se salvou. */
  saveNow: () => Promise<boolean>;
  /** Demanda do canvas — destino de uploads feitos nos nodes. */
  demandId: string | null;
};

export const FlowCanvasContext = createContext<FlowCanvasContextValue>({
  scheduleAutoSave: () => {},
  saveNow: async () => false,
  demandId: null,
});

export function useFlowCanvas() {
  return useContext(FlowCanvasContext);
}
