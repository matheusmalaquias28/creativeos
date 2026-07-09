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

export type UserRole = "admin" | "member";

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

export type Database = {
  public: {
    Tables: {
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
<<<<<<< HEAD
          magnific_space_id: string | null;
          magnific_space_url: string | null;
          magnific_space_status: MagnificSpaceStatus;
          magnific_space_error: string | null;
          magnific_space_requested_at: string | null;
          magnific_space_generated_at: string | null;
=======
          flow_graph: Json | null;
>>>>>>> 642a2f891e5a2c25d1f311f7b2b1813d7376a95e
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
<<<<<<< HEAD
          magnific_space_id?: string | null;
          magnific_space_url?: string | null;
          magnific_space_status?: MagnificSpaceStatus;
          magnific_space_error?: string | null;
          magnific_space_requested_at?: string | null;
          magnific_space_generated_at?: string | null;
=======
          flow_graph?: Json | null;
>>>>>>> 642a2f891e5a2c25d1f311f7b2b1813d7376a95e
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
<<<<<<< HEAD
          magnific_space_id: string | null;
          magnific_space_url: string | null;
          magnific_space_status: MagnificSpaceStatus;
          magnific_space_error: string | null;
          magnific_space_requested_at: string | null;
          magnific_space_generated_at: string | null;
=======
          flow_graph: Json | null;
>>>>>>> 642a2f891e5a2c25d1f311f7b2b1813d7376a95e
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
<<<<<<< HEAD
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
=======
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
        }>;
        Relationships: [];
      };
      art_generation_job: {
        Row: {
          id: string;
          demand_id: string;
          client_id: string | null;
          status: "queued" | "processing" | "succeeded" | "failed";
          prompt_final: string | null;
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
          status?: "queued" | "processing" | "succeeded" | "failed";
          prompt_final?: string | null;
          params?: Json;
          error?: string | null;
          attempts?: number;
          art_index?: number;
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          status: "queued" | "processing" | "succeeded" | "failed";
          prompt_final: string | null;
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
>>>>>>> 642a2f891e5a2c25d1f311f7b2b1813d7376a95e
        Relationships: [];
      };
    };
    Views: Record<string, never>;
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
