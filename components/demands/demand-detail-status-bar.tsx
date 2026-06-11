"use client";

import { useRouter } from "next/navigation";
import { DemandStatusSelector } from "@/components/demands/demand-status-selector";
import { DemandTimer } from "@/components/demands/demand-timer";

type Props = {
  demandId: string;
  status: string | null;
  startedAt: string | null;
  elapsedSeconds: number | null;
};

export function DemandDetailStatusBar({
  demandId,
  status,
  startedAt,
  elapsedSeconds,
}: Props) {
  const router = useRouter();

  return (
    <>
      <DemandStatusSelector
        demandId={demandId}
        currentStatus={status}
        onArchived={() => router.push("/demands")}
      />
      <DemandTimer
        status={status}
        startedAt={startedAt}
        elapsedSeconds={elapsedSeconds}
      />
    </>
  );
}
