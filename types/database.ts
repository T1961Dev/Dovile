export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          bubble_position: Json | null;
          bubble_size: number | null;
          completed_at: string | null;
          created_at: string | null;
          due_date: string | null;
          id: string;
          life_area_id: string;
          notes: string | null;
          scheduled_for: string | null;
          status: string;
          title: string;
          type: Database["public"]["Enums"]["item_type"];
          user_id: string;
          workstream_id: string | null;
        };
        Insert: {
          bubble_position?: Json | null;
          bubble_size?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          id?: string;
          life_area_id: string;
          notes?: string | null;
          scheduled_for?: string | null;
          status?: string;
          title: string;
          type: Database["public"]["Enums"]["item_type"];
          user_id: string;
          workstream_id?: string | null;
        };
        Update: {
          bubble_position?: Json | null;
          bubble_size?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          id?: string;
          life_area_id?: string;
          notes?: string | null;
          scheduled_for?: string | null;
          status?: string;
          title?: string;
          type?: Database["public"]["Enums"]["item_type"];
          user_id?: string;
          workstream_id?: string | null;
        };
        Relationships: [
          {
            columns: ["life_area_id"];
            foreignTableName: "life_areas";
            referencedColumns: ["id"];
          },
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          },
          {
            columns: ["workstream_id"];
            foreignTableName: "workstreams";
            referencedColumns: ["id"];
          }
        ];
      };
      life_areas: {
        Row: {
          bubble_position: Json | null;
          bubble_size: number | null;
          color: string;
          created_at: string | null;
          id: string;
          name: string;
          rating: number;
          vision_text: string | null;
          user_id: string;
        };
        Insert: {
          bubble_position?: Json | null;
          bubble_size?: number | null;
          color?: string;
          created_at?: string | null;
          id?: string;
          name: string;
          rating?: number;
          vision_text?: string | null;
          user_id: string;
        };
        Update: {
          bubble_position?: Json | null;
          bubble_size?: number | null;
          color?: string;
          created_at?: string | null;
          id?: string;
          name?: string;
          rating?: number;
          vision_text?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      life_area_ratings: {
        Row: {
          created_at: string | null;
          id: string;
          life_area_id: string;
          noted_at: string;
          note: string | null;
          rating: number;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          life_area_id: string;
          noted_at?: string;
          note?: string | null;
          rating: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          life_area_id?: string;
          noted_at?: string;
          note?: string | null;
          rating?: number;
        };
        Relationships: [
          {
            columns: ["life_area_id"];
            foreignTableName: "life_areas";
            referencedColumns: ["id"];
          }
        ];
      };
      idea_archive: {
        Row: {
          archived_at: string | null;
          id: string;
          idea_id: string;
          reason: string | null;
        };
        Insert: {
          archived_at?: string | null;
          id?: string;
          idea_id: string;
          reason?: string | null;
        };
        Update: {
          archived_at?: string | null;
          id?: string;
          idea_id?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            columns: ["idea_id"];
            foreignTableName: "items";
            referencedColumns: ["id"];
          }
        ];
      };
      visions: {
        Row: {
          ai_summary: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          status: string;
          target_date: string | null;
          timeframe: string;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          ai_summary?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          status?: string;
          target_date?: string | null;
          timeframe: string;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          ai_summary?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          status?: string;
          target_date?: string | null;
          timeframe?: string;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      vision_steps: {
        Row: {
          approved: boolean;
          approved_at: string | null;
          bubble_payload: Json;
          bubble_type: string;
          created_at: string | null;
          id: string;
          vision_id: string;
        };
        Insert: {
          approved?: boolean;
          approved_at?: string | null;
          bubble_payload: Json;
          bubble_type: string;
          created_at?: string | null;
          id?: string;
          vision_id: string;
        };
        Update: {
          approved?: boolean;
          approved_at?: string | null;
          bubble_payload?: Json;
          bubble_type?: string;
          created_at?: string | null;
          id?: string;
          vision_id?: string;
        };
        Relationships: [
          {
            columns: ["vision_id"];
            foreignTableName: "visions";
            referencedColumns: ["id"];
          }
        ];
      };
      settings: {
        Row: {
          calendar_provider: string | null;
          daily_capacity: number;
          timezone: string | null;
          user_id: string;
        };
        Insert: {
          calendar_provider?: string | null;
          daily_capacity?: number;
          timezone?: string | null;
          user_id: string;
        };
        Update: {
          calendar_provider?: string | null;
          daily_capacity?: number;
          timezone?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      calendar_credentials: {
        Row: {
          access_token: string | null;
          created_at: string | null;
          expiry_date: string | null;
          refresh_token: string | null;
          scope: string | null;
          token_type: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          access_token?: string | null;
          created_at?: string | null;
          expiry_date?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          token_type?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          access_token?: string | null;
          created_at?: string | null;
          expiry_date?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          token_type?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      coach_configs: {
        Row: {
          created_at: string | null;
          model: string;
          provider: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          model?: string;
          provider?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          model?: string;
          provider?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      billing_profiles: {
        Row: {
          created_at: string | null;
          customer_id: string | null;
          price_id: string | null;
          subscription_status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          customer_id?: string | null;
          price_id?: string | null;
          subscription_status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          customer_id?: string | null;
          price_id?: string | null;
          subscription_status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      workstreams: {
        Row: {
          active: boolean;
          bubble_position: Json | null;
          bubble_size: number | null;
          created_at: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["project_kind"];
          life_area_id: string;
          title: string;
          vision_id: string | null;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          bubble_position?: Json | null;
          bubble_size?: number | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["project_kind"];
          life_area_id: string;
          title: string;
          vision_id?: string | null;
          user_id: string;
        };
        Update: {
          active?: boolean;
          bubble_position?: Json | null;
          bubble_size?: number | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["project_kind"];
          life_area_id?: string;
          title?: string;
          vision_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["life_area_id"];
            foreignTableName: "life_areas";
            referencedColumns: ["id"];
          },
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      xp_events: {
        Row: {
          amount: number;
          created_at: string | null;
          id: string;
          item_id: string | null;
          kind: string;
          meta: Json | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          id?: string;
          item_id?: string | null;
          kind: string;
          meta?: Json | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          id?: string;
          item_id?: string | null;
          kind?: string;
          meta?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            columns: ["item_id"];
            foreignTableName: "items";
            referencedColumns: ["id"];
          },
          {
            columns: ["user_id"];
            foreignTableName: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: Record<string, never>;
    Enums: {
      item_type: "task" | "idea";
      project_kind: "project" | "process" | "habit";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

