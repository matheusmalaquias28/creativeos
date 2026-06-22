"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type NewDemandsCountContextValue = {
  count: number;
  increment: () => void;
  decrement: () => void;
};

const NewDemandsCountContext = createContext<NewDemandsCountContextValue | null>(
  null
);

export function NewDemandsCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCount] = useState(initialCount);

  const increment = useCallback(
    () => setCount((current) => current + 1),
    []
  );

  const decrement = useCallback(
    () => setCount((current) => Math.max(0, current - 1)),
    []
  );

  const value = useMemo(
    () => ({ count, increment, decrement }),
    [count, increment, decrement]
  );

  return (
    <NewDemandsCountContext.Provider value={value}>
      {children}
    </NewDemandsCountContext.Provider>
  );
}

export function useNewDemandsCount(): NewDemandsCountContextValue {
  const context = useContext(NewDemandsCountContext);
  if (!context) {
    throw new Error("useNewDemandsCount must be used within NewDemandsCountProvider");
  }
  return context;
}

export function useOptionalNewDemandsCount(): NewDemandsCountContextValue | null {
  return useContext(NewDemandsCountContext);
}
