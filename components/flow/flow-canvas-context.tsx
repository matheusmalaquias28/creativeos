"use client";

import { createContext, useContext } from "react";

type FlowCanvasContextValue = {
  scheduleAutoSave: () => void;
  saveNow: () => Promise<void>;
};

const noop = async () => {};

export const FlowCanvasContext = createContext<FlowCanvasContextValue>({
  scheduleAutoSave: () => {},
  saveNow: noop,
});

export function useFlowCanvas() {
  return useContext(FlowCanvasContext);
}
