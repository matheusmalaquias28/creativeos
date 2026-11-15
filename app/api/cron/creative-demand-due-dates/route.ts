import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWarDueDateChange } from "@/lib/demands/war-status-callback";

export const maxDuration = 300;

function authorized(request: Request): boolean | null {
  const secret = process.env.CREATIVE_DEMAND_DUE_CRON_SECRET?.trim();
  if (!secret) return null;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = request.headers.get("x-cron-secret")?.trim();
  return secret === bearer || secret === header;
}

async function run(request: Request) {
  const access = authorized(request);
  if (access === null) {
    return NextResponse.json({ error: "Agendamento automatico desativado (sem segredo)" }, { status: 503 });
  }
  if (!access) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  try {
    const { data, error } = await createAdminClient().rpc("assign_creative_demand_due_dates", {});
    if (error) throw new Error(error.message);

    let assigned = 0;
    let missingMaterials = 0;

    for (const result of data ?? []) {
      if (result.result_action === "missing_material") {
        missingMaterials += 1;
        await notifyWarDueDateChange({
          externalId: result.result_external_id,
          dueDate: null,
          status: result.result_status,
          rawPayload: result.result_raw_payload,
          updatedBy: "CreativeOS automatico",
        });
        continue;
      }

      assigned += 1;
      await notifyWarDueDateChange({
        externalId: result.result_external_id,
        dueDate: result.result_due_date,
        status: result.result_status,
        rawPayload: result.result_raw_payload,
        updatedBy: "CreativeOS automatico",
      });
    }

    if (assigned || missingMaterials) {
      console.info("[creative-demand-due-dates]", JSON.stringify({ assigned, missingMaterials }));
    }

    return NextResponse.json({ ok: true, assigned, missingMaterials });
  } catch (error) {
    console.error("[creative-demand-due-dates] falhou", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro inesperado" },
      { status: 500 }
    );
  }
}

export const GET = run;
export const POST = run;
