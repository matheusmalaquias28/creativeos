import type { BrandDna } from "./creative-brain";
import type { GeneratedCreative } from "./creative";
import type { ClientOpportunityId } from "@/lib/clients/opportunities";

export type ClientStatus = "draft" | "onboarding" | "active" | "archived";

export const MAGNIFIC_SPACE_STATUSES = [
  "not_generated",
  "generating",
  "ready",
  "failed",
] as const;

export type MagnificSpaceStatus = (typeof MAGNIFIC_SPACE_STATUSES)[number];

export const ART_JOB_STATUSES = [
  "draft",
  "writing_prompt",
  "awaiting_approval",
  "queued",
  "processing",
  "succeeded",
  "failed",
] as const;

export type ArtJobStatus = (typeof ART_JOB_STATUSES)[number];

export type ReferenceAssetKind =
  | "estilo"
  | "layout"
  | "tipografia"
  | "personagem"
  | "produto"
  | "textura";

export type ArtReferenceRole = "logo" | ReferenceAssetKind;

export type UserRole = "super_admin" | "admin" | "carousel_creator" | "member";

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  status: ClientStatus;
  company_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Cliente com logo e oportunidades do onboarding para listagens (cards, dashboard). */
export type ClientListItem = Client & {
  logoUrl?: string | null;
  opportunityFlags?: ClientOpportunityId[];
};

export type ClientReference = {
  id: string;
  client_id: string;
  storage_path: string;
  public_url: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  created_at: string;
};

export type ClientPhoto = {
  id: string;
  client_id: string;
  storage_path: string;
  public_url: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  magnific_creation_id: string | null;
  created_at: string;
};

export type OnboardingAnswers = {
  id: string;
  client_id: string;
  answers: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type GeradorImageRow = {
  id: string;
  user_id: string;
  url: string;
  aspect_ratio: string;
  resolution: string;
  prompt: string;
  created_at: string;
};

export type GeneratedImageRow = {
  id: string;
  user_id: string | null;
  source: string;
  prompt: string;
  aspect_ratio: string;
  resolution: string;
  storage_path: string | null;
  url: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      gerador_image: {
        Row: GeradorImageRow;
        Insert: Omit<GeradorImageRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<GeradorImageRow, "id">>;
        Relationships: [];
      };
      generated_images: {
        Row: GeneratedImageRow;
        Insert: Partial<Omit<GeneratedImageRow, "id" | "created_at" | "url">> & {
          id?: string;
          url: string;
          created_at?: string;
        };
        Update: Partial<Omit<GeneratedImageRow, "id">>;
        Relationships: [];
      };
      users: {
        Row: User;
        Insert: Omit<User, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<User, "id">>;
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: Omit<
          Client,
          "id" | "created_at" | "updated_at" | "company_info"
        > & {
          id?: string;
          company_info?: Record<string, unknown> | Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Client, "id">>;
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      client_references: {
        Row: ClientReference;
        Insert: Omit<ClientReference, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ClientReference, "id">>;
        Relationships: [
          {
            foreignKeyName: "client_references_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_photos: {
        Row: ClientPhoto;
        Insert: Omit<ClientPhoto, "id" | "created_at" | "magnific_creation_id"> & {
          id?: string;
          created_at?: string;
          magnific_creation_id?: string | null;
        };
        Update: Partial<Omit<ClientPhoto, "id">>;
        Relationships: [
          {
            foreignKeyName: "client_photos_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_answers: {
        Row: OnboardingAnswers;
        Insert: Omit<
          OnboardingAnswers,
          "id" | "created_at" | "updated_at" | "completed_at"
        > & {
          id?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<OnboardingAnswers, "id">>;
        Relationships: [
          {
            foreignKeyName: "onboarding_answers_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      generated_creatives: {
        Row: GeneratedCreative;
        Insert: {
          id?: string;
          client_id: string;
          creative_brain_id?: string | null;
          template_name?: string | null;
          prompt_payload?: Record<string, unknown> | Json;
          storage_path: string;
          public_url: string;
          mime_type?: string;
          aspect_ratio?: string | null;
          model: string;
          status?: string;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<GeneratedCreative, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "generated_creatives_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      creative_demands: {
        Row: {
          id: string;
          external_id: string;
          client_id: string | null;
          client_name_external: string;
          client_not_found: boolean;
          tipo: string | null;
          squad: string | null;
          gestor: string | null;
          webdesigner: string | null;
          solicitante: string | null;
          briefing: Json;
          artes: Json;
          status: string | null;
          is_archived: boolean;
          is_new: boolean;
          started_at: string | null;
          completed_at: string | null;
          elapsed_seconds: number | null;
          due_date: string | null;
          external_created_at: string | null;
          raw_payload: Json;
          magnific_space_id: string | null;
          magnific_space_url: string | null;
          magnific_space_status: MagnificSpaceStatus;
          magnific_space_error: string | null;
          magnific_space_requested_at: string | null;
          magnific_space_generated_at: string | null;
          magnific_space_cancel_requested: boolean;
          magnific_space_nodes: Json | null;
          flow_graph: Json | null;
          drive_folder_url: string | null;
          drive_folder_id: string | null;
          export_status: "pending" | "running" | "done" | "error";
          export_error: string | null;
          exported_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          external_id: string;
          client_id?: string | null;
          client_name_external: string;
          client_not_found?: boolean;
          tipo?: string | null;
          squad?: string | null;
          gestor?: string | null;
          webdesigner?: string | null;
          solicitante?: string | null;
          briefing?: Json;
          artes?: Json;
          status?: string | null;
          is_archived?: boolean;
          is_new?: boolean;
          started_at?: string | null;
          completed_at?: string | null;
          elapsed_seconds?: number | null;
          due_date?: string | null;
          external_created_at?: string | null;
          raw_payload?: Json;
          magnific_space_id?: string | null;
          magnific_space_url?: string | null;
          magnific_space_status?: MagnificSpaceStatus;
          magnific_space_error?: string | null;
          magnific_space_requested_at?: string | null;
          magnific_space_generated_at?: string | null;
          magnific_space_cancel_requested?: boolean;
          magnific_space_nodes?: Json | null;
          flow_graph?: Json | null;
          drive_folder_url?: string | null;
          drive_folder_id?: string | null;
          export_status?: "pending" | "running" | "done" | "error";
          export_error?: string | null;
          exported_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          client_id: string | null;
          client_name_external: string;
          client_not_found: boolean;
          tipo: string | null;
          squad: string | null;
          gestor: string | null;
          webdesigner: string | null;
          solicitante: string | null;
          briefing: Json;
          artes: Json;
          status: string | null;
          is_archived: boolean;
          is_new: boolean;
          started_at: string | null;
          completed_at: string | null;
          elapsed_seconds: number | null;
          due_date: string | null;
          external_created_at: string | null;
          raw_payload: Json;
          magnific_space_id: string | null;
          magnific_space_url: string | null;
          magnific_space_status: MagnificSpaceStatus;
          magnific_space_error: string | null;
          magnific_space_requested_at: string | null;
          magnific_space_generated_at: string | null;
          magnific_space_cancel_requested: boolean;
          magnific_space_nodes: Json | null;
          flow_graph: Json | null;
          drive_folder_url: string | null;
          drive_folder_id: string | null;
          export_status: "pending" | "running" | "done" | "error";
          export_error: string | null;
          exported_at: string | null;
          updated_at: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "creative_demands_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      demand_export_files: {
        Row: {
          id: string;
          demand_id: string;
          art_index: number;
          format: "feed" | "story";
          filename: string;
          storage_path: string;
          public_url: string;
          mime_type: string | null;
          file_size: number | null;
          drive_file_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          demand_id: string;
          art_index: number;
          format: "feed" | "story";
          filename: string;
          storage_path: string;
          public_url: string;
          mime_type?: string | null;
          file_size?: number | null;
          drive_file_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          art_index: number;
          format: "feed" | "story";
          filename: string;
          storage_path: string;
          public_url: string;
          mime_type: string | null;
          file_size: number | null;
          drive_file_id: string | null;
          updated_at: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "demand_export_files_demand_id_fkey";
            columns: ["demand_id"];
            isOneToOne: false;
            referencedRelation: "creative_demands";
            referencedColumns: ["id"];
          },
        ];
      };
      mvp_projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          docx_file_name: string | null;
          raw_content: string | null;
          pages: Json;
          logo_url: string | null;
          reference_urls: Json;
          status: string;
          error: string | null;
          space_id: string | null;
          space_url: string | null;
          space_nodes: Json | null;
          cancel_requested: boolean;
          organize_progress: number;
          generated_batches: number;
          total_batches: number;
          requested_at: string | null;
          generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          docx_file_name?: string | null;
          raw_content?: string | null;
          pages?: Json;
          logo_url?: string | null;
          reference_urls?: Json;
          status?: string;
          error?: string | null;
          space_id?: string | null;
          space_url?: string | null;
          space_nodes?: Json | null;
          cancel_requested?: boolean;
          organize_progress?: number;
          generated_batches?: number;
          total_batches?: number;
          requested_at?: string | null;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          title: string;
          docx_file_name: string | null;
          raw_content: string | null;
          pages: Json;
          logo_url: string | null;
          reference_urls: Json;
          status: string;
          error: string | null;
          space_id: string | null;
          space_url: string | null;
          space_nodes: Json | null;
          cancel_requested: boolean;
          organize_progress: number;
          generated_batches: number;
          total_batches: number;
          requested_at: string | null;
          generated_at: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      creative_brains: {
        Row: {
          id: string;
          client_id: string;
          brand_dna: BrandDna;
          version: number;
          status: Database["public"]["Enums"]["creative_brain_status"];
          generated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          brand_dna?: BrandDna | Json;
          version?: number;
          status?: Database["public"]["Enums"]["creative_brain_status"];
          generated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          brand_dna: BrandDna | Json;
          version: number;
          status: Database["public"]["Enums"]["creative_brain_status"];
          generated_by: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "creative_brains_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      magnific_oauth_tokens: {
        Row: {
          id: number;
          client_id: string | null;
          client_secret: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_type: string | null;
          scope: string | null;
          expires_at: string | null;
          code_verifier: string | null;
          state: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["magnific_oauth_tokens"]["Row"]> & {
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["magnific_oauth_tokens"]["Row"]>;
        Relationships: [];
      };
      google_drive_oauth_tokens: {
        Row: {
          id: number;
          google_email: string | null;
          refresh_token: string;
          access_token: string | null;
          expires_at: string | null;
          connected_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["google_drive_oauth_tokens"]["Row"]> & {
          id?: number;
          refresh_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_drive_oauth_tokens"]["Row"]>;
        Relationships: [];
      };
      demand_reference_image: {
        Row: {
          id: string;
          demand_id: string;
          storage_path: string;
          storage_url: string;
          file_name: string;
          mime_type: string | null;
          file_size: number | null;
          role: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          demand_id: string;
          storage_path: string;
          storage_url: string;
          file_name: string;
          mime_type?: string | null;
          file_size?: number | null;
          role?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<{
          role: string | null;
          position: number;
        }>;
        Relationships: [];
      };
      client_creative_profile: {
        Row: {
          id: string;
          client_id: string;
          base_prompt: string;
          palette: string[];
          style_reference_urls: string[];
          logo_url: string | null;
          logo_mode: "reference" | "composite";
          logo_placement: Json;
          image_size: "1K" | "2K" | "4K";
          aspect_ratio: string;
          identity_sample_url: string | null;
          identity_sample_storage_path: string | null;
          identity_sample_urls: string[];
          identity_sample_storage_paths: string[];
          visual_identity_dna: Json | null;
          identity_extracted_at: string | null;
          identity_extraction_status: "idle" | "extracting" | "ready" | "failed";
          identity_extraction_error: string | null;
          direction_notes: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          base_prompt?: string;
          palette?: string[];
          style_reference_urls?: string[];
          logo_url?: string | null;
          logo_mode?: "reference" | "composite";
          logo_placement?: Json;
          image_size?: "1K" | "2K" | "4K";
          aspect_ratio?: string;
          identity_sample_urls?: string[];
          identity_sample_storage_paths?: string[];
          visual_identity_dna?: Json | null;
          identity_extracted_at?: string | null;
          identity_extraction_status?: "idle" | "extracting" | "ready" | "failed";
          identity_extraction_error?: string | null;
          direction_notes?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          base_prompt: string;
          palette: string[];
          style_reference_urls: string[];
          logo_url: string | null;
          logo_mode: "reference" | "composite";
          logo_placement: Json;
          image_size: "1K" | "2K" | "4K";
          aspect_ratio: string;
          identity_sample_urls: string[];
          identity_sample_storage_paths: string[];
          visual_identity_dna: Json | null;
          identity_extracted_at: string | null;
          identity_extraction_status: "idle" | "extracting" | "ready" | "failed";
          identity_extraction_error: string | null;
          direction_notes: Json;
        }>;
        Relationships: [];
      };
      client_flow_graph: {
        Row: {
          id: string;
          client_id: string;
          graph: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          graph?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          graph: Json;
          updated_at: string;
        }>;
        Relationships: [];
      };
      client_magnific_space: {
        Row: {
          id: string;
          client_id: string;
          space_id: string;
          space_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          space_id: string;
          space_url: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          space_id: string;
          space_url: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      art_generation_job: {
        Row: {
          id: string;
          demand_id: string;
          client_id: string | null;
          status: ArtJobStatus;
          prompt_final: string | null;
          prompt_draft: string | null;
          prompt_edited: string | null;
          prompt_approved_at: string | null;
          prompt_approved_by: string | null;
          direction: Json | null;
          use_client_photos: boolean;
          params: Json;
          error: string | null;
          attempts: number;
          art_index: number;
          approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          demand_id: string;
          client_id?: string | null;
          status?: ArtJobStatus;
          prompt_final?: string | null;
          prompt_draft?: string | null;
          prompt_edited?: string | null;
          prompt_approved_at?: string | null;
          prompt_approved_by?: string | null;
          direction?: Json | null;
          use_client_photos?: boolean;
          params?: Json;
          error?: string | null;
          attempts?: number;
          art_index?: number;
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          status: ArtJobStatus;
          prompt_final: string | null;
          prompt_draft: string | null;
          prompt_edited: string | null;
          prompt_approved_at: string | null;
          prompt_approved_by: string | null;
          direction: Json | null;
          use_client_photos: boolean;
          params: Json;
          error: string | null;
          attempts: number;
          approved: boolean;
          updated_at: string;
        }>;
        Relationships: [];
      };
      art_version: {
        Row: {
          id: string;
          job_id: string;
          version_number: number;
          result_url: string;
          storage_path: string;
          instruction: string | null;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          version_number?: number;
          result_url: string;
          storage_path: string;
          instruction?: string | null;
          is_current?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          is_current: boolean;
          instruction: string | null;
        }>;
        Relationships: [];
      };
      carousels: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          format: "carousel" | "square" | "stories";
          post_style: "minimal" | "profile" | "creator" | "techviral" | "viralsaas";
          slides: Json;
          design: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          format?: "carousel" | "square" | "stories";
          post_style?: "minimal" | "profile" | "creator" | "techviral" | "viralsaas";
          slides?: Json;
          design?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          name: string;
          format: "carousel" | "square" | "stories";
          post_style: "minimal" | "profile" | "creator" | "techviral" | "viralsaas";
          slides: Json;
          design: Json;
          updated_at: string;
        }>;
        Relationships: [];
      };
      tweet_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          handle: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          handle: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          name: string;
          handle: string;
          avatar_url: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      tweet_carousels: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string | null;
          name: string;
          profile: Json;
          theme: "light" | "dark";
          cards: Json;
          source: "ai" | "manual";
          source_input: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id?: string | null;
          name?: string;
          profile?: Json;
          theme?: "light" | "dark";
          cards?: Json;
          source?: "ai" | "manual";
          source_input?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          profile_id: string | null;
          name: string;
          profile: Json;
          theme: "light" | "dark";
          cards: Json;
          updated_at: string;
        }>;
        Relationships: [];
      };
      client_subscriptions: {
        Row: {
          id: string;
          source: string;
          external_id: string;
          client_id: string | null;
          client_not_found: boolean;
          buyer_name: string;
          buyer_email: string;
          product_name: string | null;
          status: "active" | "payment_issue" | "canceled";
          hubla_status: string | null;
          auto_renew: boolean;
          payment_method: string | null;
          billing_cycle_months: number;
          amount_cents: number;
          currency: string;
          salesperson: "matheus" | "paulo_junior" | null;
          activated_at: string | null;
          canceled_at: string | null;
          last_invoice_status: string | null;
          last_invoice_due_date: string | null;
          last_event_at: string | null;
          raw_payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source?: string;
          external_id: string;
          client_id?: string | null;
          client_not_found?: boolean;
          buyer_name?: string;
          buyer_email?: string;
          product_name?: string | null;
          status?: "active" | "payment_issue" | "canceled";
          hubla_status?: string | null;
          auto_renew?: boolean;
          payment_method?: string | null;
          billing_cycle_months?: number;
          amount_cents?: number;
          currency?: string;
          salesperson?: "matheus" | "paulo_junior" | null;
          activated_at?: string | null;
          canceled_at?: string | null;
          last_invoice_status?: string | null;
          last_invoice_due_date?: string | null;
          last_event_at?: string | null;
          raw_payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          client_id: string | null;
          client_not_found: boolean;
          buyer_name: string;
          buyer_email: string;
          product_name: string | null;
          status: "active" | "payment_issue" | "canceled";
          hubla_status: string | null;
          auto_renew: boolean;
          payment_method: string | null;
          billing_cycle_months: number;
          amount_cents: number;
          currency: string;
          salesperson: "matheus" | "paulo_junior" | null;
          activated_at: string | null;
          canceled_at: string | null;
          last_invoice_status: string | null;
          last_invoice_due_date: string | null;
          last_event_at: string | null;
          raw_payload: Json;
          updated_at: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_subscription_payments: {
        Row: {
          id: string;
          subscription_id: string;
          invoice_external_id: string;
          amount_cents: number;
          currency: string;
          paid_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          invoice_external_id: string;
          amount_cents: number;
          currency?: string;
          paid_at?: string;
          created_at?: string;
        };
        Update: Partial<{
          amount_cents: number;
          currency: string;
          paid_at: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "client_subscription_payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "client_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      carousel_profiles: {
        Row: {
          id: string;
          user_id: string;
          client_id: string | null;
          name: string;
          logo_url: string | null;
          logo_storage_path: string | null;
          font_title: string | null;
          font_body: string | null;
          color_background: string;
          color_title: string;
          color_subtitle: string;
          color_accent: string;
          palette: Json;
          reference_images: Json;
          instagram_handle: string | null;
          business_context: string | null;
          context_md: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id?: string | null;
          name?: string;
          logo_url?: string | null;
          logo_storage_path?: string | null;
          font_title?: string | null;
          font_body?: string | null;
          color_background?: string;
          color_title?: string;
          color_subtitle?: string;
          color_accent?: string;
          palette?: Json;
          reference_images?: Json;
          instagram_handle?: string | null;
          business_context?: string | null;
          context_md?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          client_id: string | null;
          name: string;
          logo_url: string | null;
          logo_storage_path: string | null;
          font_title: string | null;
          font_body: string | null;
          color_background: string;
          color_title: string;
          color_subtitle: string;
          color_accent: string;
          palette: Json;
          reference_images: Json;
          instagram_handle: string | null;
          business_context: string | null;
          context_md: string | null;
          updated_at: string;
        }>;
        Relationships: [
          {
            foreignKeyName: "carousel_profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_reference_asset: {
        Row: {
          id: string;
          client_id: string;
          kind: ReferenceAssetKind;
          storage_url: string;
          storage_path: string | null;
          file_name: string | null;
          ai_description: string | null;
          ai_tags: string[];
          dominant_colors: Json;
          annotation_status: "idle" | "annotating" | "ready" | "failed";
          annotation_error: string | null;
          usage_count: number;
          last_used_at: string | null;
          is_winner: boolean;
          active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          kind?: ReferenceAssetKind;
          storage_url: string;
          storage_path?: string | null;
          file_name?: string | null;
          ai_description?: string | null;
          ai_tags?: string[];
          dominant_colors?: Json;
          annotation_status?: "idle" | "annotating" | "ready" | "failed";
          annotation_error?: string | null;
          usage_count?: number;
          last_used_at?: string | null;
          is_winner?: boolean;
          active?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          kind: ReferenceAssetKind;
          ai_description: string | null;
          ai_tags: string[];
          dominant_colors: Json;
          annotation_status: "idle" | "annotating" | "ready" | "failed";
          annotation_error: string | null;
          usage_count: number;
          last_used_at: string | null;
          is_winner: boolean;
          active: boolean;
          position: number;
        }>;
        Relationships: [
          {
            foreignKeyName: "client_reference_asset_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      art_job_reference: {
        Row: {
          id: string;
          job_id: string;
          asset_id: string | null;
          storage_url: string;
          role: ArtReferenceRole;
          intent: string | null;
          position: number;
          source: "ai" | "manual" | "client_fixed";
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          asset_id?: string | null;
          storage_url: string;
          role: ArtReferenceRole;
          intent?: string | null;
          position?: number;
          source?: "ai" | "manual" | "client_fixed";
          created_at?: string;
        };
        Update: Partial<{
          asset_id: string | null;
          storage_url: string;
          role: ArtReferenceRole;
          intent: string | null;
          position: number;
          source: "ai" | "manual" | "client_fixed";
        }>;
        Relationships: [
          {
            foreignKeyName: "art_job_reference_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "art_generation_job";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      client_art_readiness: {
        Row: {
          client_id: string;
          name: string;
          /** Logo efetiva: perfil criativo, com fallback no onboarding. */
          logo_url: string | null;
          has_logo: boolean;
          has_palette: boolean;
          has_dna: boolean;
          reference_count: number;
          style_reference_count: number;
          is_ready: boolean;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      client_status: ClientStatus;
      creative_brain_status:
        | "generating"
        | "draft"
        | "approved"
        | "archived"
        | "failed";
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
