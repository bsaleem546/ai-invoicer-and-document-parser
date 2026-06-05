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
      documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["doc_type"] | null
          error_message: string | null
          extracted_at: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          status: Database["public"]["Enums"]["doc_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["doc_type"] | null
          error_message?: string | null
          extracted_at?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["doc_type"] | null
          error_message?: string | null
          extracted_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          user_id?: string
        }
        Relationships: []
      }
      duplicate_flags: {
        Row: {
          created_at: string
          dismissed: boolean
          document_id: string
          id: string
          match_reason: string | null
          matched_document_id: string
        }
        Insert: {
          created_at?: string
          dismissed?: boolean
          document_id: string
          id?: string
          match_reason?: string | null
          matched_document_id: string
        }
        Update: {
          created_at?: string
          dismissed?: boolean
          document_id?: string
          id?: string
          match_reason?: string | null
          matched_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_flags_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_flags_matched_document_id_fkey"
            columns: ["matched_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_data: {
        Row: {
          confidence_fields: Json | null
          confidence_score: number | null
          created_at: string
          currency: string | null
          document_id: string
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          raw_extraction_json: Json | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          user_edited: boolean
          vendor_name: string | null
        }
        Insert: {
          confidence_fields?: Json | null
          confidence_score?: number | null
          created_at?: string
          currency?: string | null
          document_id: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          raw_extraction_json?: Json | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_edited?: boolean
          vendor_name?: string | null
        }
        Update: {
          confidence_fields?: Json | null
          confidence_score?: number | null
          created_at?: string
          currency?: string | null
          document_id?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          raw_extraction_json?: Json | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_edited?: boolean
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_data_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          created_at: string
          description: string | null
          document_id: string
          id: string
          line_total: number | null
          position: number
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          description?: string | null
          document_id: string
          id?: string
          line_total?: number | null
          position?: number
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          description?: string | null
          document_id?: string
          id?: string
          line_total?: number | null
          position?: number
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "line_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          documents_used_this_month: number
          email: string | null
          full_name: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          stripe_customer_id: string | null
          updated_at: string
          usage_period_start: string
        }
        Insert: {
          created_at?: string
          documents_used_this_month?: number
          email?: string | null
          full_name?: string | null
          id: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          stripe_customer_id?: string | null
          updated_at?: string
          usage_period_start?: string
        }
        Update: {
          created_at?: string
          documents_used_this_month?: number
          email?: string | null
          full_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          stripe_customer_id?: string | null
          updated_at?: string
          usage_period_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      confidence_level: "high" | "medium" | "low"
      doc_status: "processing" | "review" | "exported" | "error"
      doc_type: "invoice" | "receipt" | "purchase_order" | "other"
      plan_tier: "free" | "pro" | "team"
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
      confidence_level: ["high", "medium", "low"],
      doc_status: ["processing", "review", "exported", "error"],
      doc_type: ["invoice", "receipt", "purchase_order", "other"],
      plan_tier: ["free", "pro", "team"],
    },
  },
} as const
