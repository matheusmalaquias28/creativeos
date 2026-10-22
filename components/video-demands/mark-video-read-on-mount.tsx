"use client";

import { useEffect } from "react";
import { markVideoDemandAsReadAction } from "@/actions/video-demands";

export function MarkVideoReadOnMount({
  demandId,
  isNew,
}: {
  demandId: string;
  isNew: boolean;
}) {
  useEffect(() => {
    if (!isNew) return;
    void markVideoDemandAsReadAction(demandId);
  }, [demandId, isNew]);

  return null;
}
