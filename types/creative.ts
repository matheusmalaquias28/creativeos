export type GeneratedCreativeStatus = "pending" | "completed" | "failed";

export type GeneratedCreative = {
  id: string;
  client_id: string;
  creative_brain_id: string | null;
  template_name: string | null;
  prompt_payload: Record<string, unknown>;
  storage_path: string;
  public_url: string;
  mime_type: string;
  aspect_ratio: string | null;
  model: string;
  status: GeneratedCreativeStatus;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};
