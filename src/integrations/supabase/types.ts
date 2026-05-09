export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      match_alerts_sent: {
        Row: {
          other_id: string
          score_pct: number
          sent_at: string
          user_id: string
        }
        Insert: {
          other_id: string
          score_pct: number
          sent_at?: string
          user_id: string
        }
        Update: {
          other_id?: string
          score_pct?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pro_waitlist: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          album_progress: number
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          discoverable: boolean
          full_name: string | null
          id: string
          lat: number | null
          lng: number | null
          location_updated_at: string | null
          notification_prefs: Json
          plan: string
          trades_count: number
          updated_at: string
        }
        Insert: {
          album_progress?: number
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          discoverable?: boolean
          full_name?: string | null
          id: string
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          notification_prefs?: Json
          plan?: string
          trades_count?: number
          updated_at?: string
        }
        Update: {
          album_progress?: number
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          discoverable?: boolean
          full_name?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          notification_prefs?: Json
          plan?: string
          trades_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          reviewed_id: string
          reviewer_id: string
          stars: number
          trade_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          reviewed_id: string
          reviewer_id: string
          stars: number
          trade_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          reviewed_id?: string
          reviewer_id?: string
          stars?: number
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      stickers: {
        Row: {
          code: string
          country_code: string
          country_name: string
          flag_emoji: string
          group_letter: string
          image_url: string | null
          kind: string
          ocr_confidence: number | null
          ocr_processed_at: string | null
          player_name: string | null
          player_name_source: string | null
          position: number
        }
        Insert: {
          code: string
          country_code: string
          country_name: string
          flag_emoji?: string
          group_letter: string
          image_url?: string | null
          kind: string
          ocr_confidence?: number | null
          ocr_processed_at?: string | null
          player_name?: string | null
          player_name_source?: string | null
          position: number
        }
        Update: {
          code?: string
          country_code?: string
          country_name?: string
          flag_emoji?: string
          group_letter?: string
          image_url?: string | null
          kind?: string
          ocr_confidence?: number | null
          ocr_processed_at?: string | null
          player_name?: string | null
          player_name_source?: string | null
          position?: number
        }
        Relationships: []
      }
      trade_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          trade_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          trade_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_messages_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          id: string
          offered_stickers: string[]
          receiver_id: string
          requested_stickers: string[]
          requester_id: string
          status: Database["public"]["Enums"]["trade_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          offered_stickers?: string[]
          receiver_id: string
          requested_stickers?: string[]
          requester_id: string
          status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          offered_stickers?: string[]
          receiver_id?: string
          requested_stickers?: string[]
          requester_id?: string
          status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stickers: {
        Row: {
          created_at: string
          duplicates: number
          sticker_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicates?: number
          sticker_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          duplicates?: number
          sticker_code?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_trade_participant: {
        Args: { _trade: string; _user: string }
        Returns: boolean
      }
      match_collectors: {
        Args: { _radius_km?: number }
        Returns: {
          album_progress: number
          avatar_url: string
          city: string
          compat_album: boolean
          distance_km: number
          full_name: string
          give_count: number
          id: string
          mutual_count: number
          nationwide: boolean
          out_of_radius: boolean
          plan: string
          proximity_score: number
          receive_count: number
          recent_active: boolean
          region_bonus: number
          same_city: boolean
          score_pct: number
          trades_count: number
        }[]
      }
      nearby_collectors: {
        Args: { _radius_km?: number }
        Returns: {
          album_progress: number
          avatar_url: string
          city: string
          compat_score: number
          distance_km: number
          full_name: string
          id: string
          match_count: number
          plan: string
          proximity_score: number
          reverse_match_count: number
          trades_count: number
        }[]
      }
      scan_match_alerts: { Args: never; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
      trade_status:
        | "pending"
        | "accepted"
        | "declined"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      trade_status: [
        "pending",
        "accepted",
        "declined",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
