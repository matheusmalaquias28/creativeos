"use client";

import { useRouter } from "next/navigation";
import { DemandStatusSelector } from "@/components/demands/demand-status-selector";
import { DemandTimer } from "@/components/demands/demand-timer";
import {
  DemandClientLinker,
  type DemandClientOption,
} from "@/components/demands/demand-client-linker";

type Props = {
  demandId: string;
  status: string | null;
  startedAt: string | null;
  elapsedSeconds: number | null;
  currentClientId: string | null;
  currentClientName?: string | null;
  externalClientName: string;
  clientNotFound: boolean;
  clients: DemandClientOption[];
};

export function DemandDetailStatusBar({
  demandId,
  status,
  startedAt,
  elapsedSeconds,
  currentClientId,
  currentClientName,
  externalClientName,
  clientNotFound,
  clients,
}: Props) {
  const router = useRouter();

  return (
    <>
      <DemandStatusSelector
        demandId={demandId}
        currentStatus={status}
        onArchived={() => router.push("/demands")}
      />
      <DemandClientLinker
        demandId={demandId}
        currentClientId={currentClientId}
        currentClientName={currentClientName}
        externalClientName={externalClientName}
        clientNotFound={clientNotFound}
        clients={clients}
      />
      <DemandTimer
        status={status}
        startedAt={startedAt}
        elapsedSeconds={elapsedSeconds}
      />
    </>
  );
}
