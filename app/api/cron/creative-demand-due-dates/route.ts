import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWarDueDateChange } from "@/lib/demands/war-status-callback";
import { notifyCreativeDemandAgent } from "@/lib/demands/creative-agent-webhook";

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
    for (const result of data ?? []) {
      assigned += 1;
      await notifyWarDueDateChange({
        externalId: result.result_external_id,
        dueDate: result.result_due_date,
        status: result.result_status,
        rawPayload: result.result_raw_payload,
        updatedBy: "CreativeOS automatico",
      });
    }

    let agentTaskDispatched = 0;
    const agentWebhookConfigured = Boolean(
      process.env.OPENBOT_CREATIVE_DEMAND_WEBHOOK_URL?.trim() &&
        process.env.OPENBOT_CREATIVE_DEMAND_WEBHOOK_SECRET?.trim()
    );
    const { data: claims, error: claimError } = agentWebhookConfigured
      ? await createAdminClient().rpc("claim_creative_demand_agent_task", {})
      : { data: [], error: null };
    if (claimError) throw new Error(claimError.message);

    for (const claim of claims ?? []) {
      if (claim.result_action === "blocked") {
        continue;
      }

      if (claim.result_action !== "claimed" && claim.result_action !== "check_materials") continue;

      const supabase = createAdminClient();
      const { data: handedOff, error: handoffError } = await supabase
        .from("creative_demands")
        .update({ art_auto_generation_status: "awaiting_agent" })
        .eq("id", claim.result_demand_id)
        .eq("art_auto_generation_status", "processing")
        .eq("is_archived", false)
        .select("id")
        .maybeSingle();
      if (handoffError) throw new Error(handoffError.message);
      if (!handedOff) continue;

      const { data: demand, error: demandError } = await supabase
        .from("creative_demands")
        .select("id, external_id, client_name_external, briefing, artes, status, due_date, updated_at, is_archived")
        .eq("id", claim.result_demand_id)
        .eq("art_auto_generation_status", "awaiting_agent")
        .maybeSingle();
      if (demandError) throw new Error(demandError.message);
      if (!demand || demand.is_archived) continue;

      const sent = await notifyCreativeDemandAgent(
        demand,
        claim.result_action === "check_materials" ? "check_materials" : "scheduled"
      );
      if (sent) {
        agentTaskDispatched += 1;
      } else {
        const { error: retryError } = await supabase
          .from("creative_demands")
          .update({ art_auto_generation_status: "pending", art_auto_generation_started_at: null })
          .eq("id", demand.id)
          .eq("art_auto_generation_status", "awaiting_agent");
        if (retryError) throw new Error(retryError.message);
      }
    }

    if (assigned || agentTaskDispatched) {
      console.info(
        "[creative-demand-due-dates]",
        JSON.stringify({ assigned, agentTaskDispatched })
      );
    }

    return NextResponse.json({ ok: true, assigned, agentTaskDispatched });
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
