"use client";

import { useEffect } from "react";
import { markDemandAsReadAction } from "@/actions/demands";
import { useOptionalNewDemandsCount } from "@/components/demands/new-demands-count-provider";

type Props = {
  demandId: string;
  isNew: boolean;
};

export function MarkDemandReadOnMount({ demandId, isNew }: Props) {
  const demandsCount = useOptionalNewDemandsCount();

  useEffect(() => {
    if (!isNew) return;

    void markDemandAsReadAction(demandId).then(() => {
      demandsCount?.decrement();
    });
  }, [demandId, isNew, demandsCount]);

  return null;
}
