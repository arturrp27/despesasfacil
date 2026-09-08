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
      categories: {
        Row: {
          active: boolean
          color: string
          created_at: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name: string
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      income_rules: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          default_amount: number
          id: string
          kind: Database["public"]["Enums"]["income_rule_kind"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          default_amount: number
          id?: string
          kind: Database["public"]["Enums"]["income_rule_kind"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          default_amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["income_rule_kind"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_groups: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          first_due_date: string
          id: string
          installments_count: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          total_amount: number
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description: string
          first_due_date: string
          id?: string
          installments_count: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          total_amount: number
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          first_due_date?: string
          id?: string
          installments_count?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_groups_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          day_of_month: number | null
          description: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          start_date: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number | null
          description: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          start_date: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number | null
          description?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          competence_month: string
          created_at: string
          description: string
          due_date: string
          id: string
          income_rule_id: string | null
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          is_installment: boolean
          is_recurring: boolean
          notes: string | null
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          recurring_rule_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          competence_month: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          income_rule_id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          notes?: string | null
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          recurring_rule_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          competence_month?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          income_rule_id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_installment?: boolean
          is_recurring?: boolean
          notes?: string | null
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          recurring_rule_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_income_rule_id_fkey"
            columns: ["income_rule_id"]
            isOneToOne: false
            referencedRelation: "income_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_installment_group_id_fkey"
            columns: ["installment_group_id"]
            isOneToOne: false
            referencedRelation: "installment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
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
      user_settings: {
        Row: {
          created_at: string
          days_before_due: number
          notify_due: boolean
          notify_new_transactions: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_before_due?: number
          notify_due?: boolean
          notify_new_transactions?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_before_due?: number
          notify_due?: boolean
          notify_new_transactions?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_installment_plan: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_description: string
          p_first_due_date: string
          p_installments: number
          p_notes?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
      create_recurring_expense: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_description: string
          p_frequency: Database["public"]["Enums"]["recurrence_frequency"]
          p_notes?: string
          p_occurrences?: number
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_start_date: string
        }
        Returns: string
      }
      delete_transaction_scope: {
        Args: { p_scope: string; p_transaction_id: string }
        Returns: number
      }
      ensure_income_transactions: {
        Args: { p_months?: number }
        Returns: number
      }
      generate_due_notifications: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      income_rule_due_date: {
        Args: {
          p_competence: string
          p_kind: Database["public"]["Enums"]["income_rule_kind"]
        }
        Returns: string
      }
      nth_business_day: {
        Args: { p_month: string; p_n: number }
        Returns: string
      }
      resize_installment_plan: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_description: string
          p_group_id: string
          p_installments: number
          p_notes?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Returns: number
      }
      update_transaction_scope: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_competence_month?: string
          p_description: string
          p_due_date: string
          p_notes?: string
          p_payment_date?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_scope: string
          p_status: Database["public"]["Enums"]["transaction_status"]
          p_transaction_id: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: number
      }
      upsert_income_rule: {
        Args: {
          p_active?: boolean
          p_apply_future?: boolean
          p_category_id?: string
          p_default_amount: number
          p_kind: Database["public"]["Enums"]["income_rule_kind"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      category_kind: "receita" | "despesa" | "ambos"
      income_rule_kind: "vale" | "salario"
      payment_method:
        | "pix"
        | "dinheiro"
        | "debito"
        | "boleto"
        | "transferencia"
        | "outro"
      recurrence_frequency: "mensal" | "semanal" | "anual"
      transaction_status: "pago" | "pendente"
      transaction_type: "receita" | "despesa"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      category_kind: ["receita", "despesa", "ambos"],
      income_rule_kind: ["vale", "salario"],
      payment_method: [
        "pix",
        "dinheiro",
        "debito",
        "boleto",
        "transferencia",
        "outro",
      ],
      recurrence_frequency: ["mensal", "semanal", "anual"],
      transaction_status: ["pago", "pendente"],
      transaction_type: ["receita", "despesa"],
    },
  },
} as const
