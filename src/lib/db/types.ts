// Sinh tự động bởi `pnpm db:types` — KHÔNG SỬA TAY.
// Nguồn: schema của database dev. Sửa schema thì viết migration mới rồi chạy lại lệnh trên.
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          entity: string
          entity_id: string | null
          id: string
          store_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          store_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          closed_at: string | null
          counted_cash: number | null
          created_at: string
          created_by: string | null
          expected_cash: number | null
          id: string
          note: string | null
          opened_at: string
          opening_float: number
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          user_id: string
          variance: number | null
        }
        Insert: {
          closed_at?: string | null
          counted_cash?: number | null
          created_at?: string
          created_by?: string | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opening_float?: number
          status?: Database["public"]["Enums"]["shift_status"]
          store_id: string
          user_id: string
          variance?: number | null
        }
        Update: {
          closed_at?: string | null
          counted_cash?: number | null
          created_at?: string
          created_by?: string | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opening_float?: number
          status?: Database["public"]["Enums"]["shift_status"]
          store_id?: string
          user_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          client_uuid: string
          created_at: string
          created_by: string | null
          id: string
          reason: string
          shift_id: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["cash_txn_source"]
          store_id: string
          type: Database["public"]["Enums"]["cash_txn_type"]
        }
        Insert: {
          amount: number
          client_uuid: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          shift_id: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["cash_txn_source"]
          store_id: string
          type: Database["public"]["Enums"]["cash_txn_type"]
        }
        Update: {
          amount?: number
          client_uuid?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          shift_id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["cash_txn_source"]
          store_id?: string
          type?: Database["public"]["Enums"]["cash_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cash_transactions_shift"
            columns: ["shift_id", "store_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          customer_group: Database["public"]["Enums"]["customer_group"]
          id: string
          is_active: boolean
          name: string
          name_normalized: string | null
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          customer_group?: Database["public"]["Enums"]["customer_group"]
          id?: string
          is_active?: boolean
          name: string
          name_normalized?: string | null
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          customer_group?: Database["public"]["Enums"]["customer_group"]
          id?: string
          is_active?: boolean
          name?: string
          name_normalized?: string | null
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inbound_items: {
        Row: {
          created_at: string
          factor: number
          id: string
          line_no: number
          line_total: number | null
          qty_base: number
          qty_input: number
          receipt_id: string
          store_id: string
          unit_cost_base: number | null
          unit_cost_input: number
          uom_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          factor: number
          id?: string
          line_no: number
          line_total?: number | null
          qty_base: number
          qty_input: number
          receipt_id: string
          store_id: string
          unit_cost_base?: number | null
          unit_cost_input: number
          uom_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          factor?: number
          id?: string
          line_no?: number
          line_total?: number | null
          qty_base?: number
          qty_input?: number
          receipt_id?: string
          store_id?: string
          unit_cost_base?: number | null
          unit_cost_input?: number
          uom_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inbound_items_receipt"
            columns: ["receipt_id", "store_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "inbound_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_receipts: {
        Row: {
          client_uuid: string
          created_at: string
          created_by: string | null
          debt_amount: number
          id: string
          note: string | null
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          receipt_date: string
          receipt_no: string
          status: Database["public"]["Enums"]["inbound_status"]
          store_id: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          client_uuid: string
          created_at?: string
          created_by?: string | null
          debt_amount?: number
          id?: string
          note?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          receipt_date?: string
          receipt_no: string
          status?: Database["public"]["Enums"]["inbound_status"]
          store_id: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          client_uuid?: string
          created_at?: string
          created_by?: string | null
          debt_amount?: number
          id?: string
          note?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          receipt_date?: string
          receipt_no?: string
          status?: Database["public"]["Enums"]["inbound_status"]
          store_id?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      item_groups: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      number_sequences: {
        Row: {
          current_no: number
          doc_type: string
          period: string
          store_id: string
        }
        Insert: {
          current_no?: number
          doc_type: string
          period: string
          store_id: string
        }
        Update: {
          current_no?: number
          doc_type?: string
          period?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "number_sequences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          factor: number
          id: string
          line_discount: number
          line_no: number
          line_total: number | null
          order_id: string
          qty_base: number
          qty_input: number
          store_id: string
          unit_price_input: number
          uom_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          factor: number
          id?: string
          line_discount?: number
          line_no: number
          line_total?: number | null
          order_id: string
          qty_base: number
          qty_input: number
          store_id: string
          unit_price_input: number
          uom_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          factor?: number
          id?: string
          line_discount?: number
          line_no?: number
          line_total?: number | null
          order_id?: string
          qty_base?: number
          qty_input?: number
          store_id?: string
          unit_price_input?: number
          uom_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_items_order"
            columns: ["order_id", "store_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_uuid: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          debt_amount: number
          discount_order: number
          due_date: string | null
          id: string
          note: string | null
          order_kind: Database["public"]["Enums"]["order_kind"]
          order_no: string | null
          paid_amount: number
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          price_list_id: string
          shift_id: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          client_uuid: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          debt_amount?: number
          discount_order?: number
          due_date?: string | null
          id?: string
          note?: string | null
          order_kind: Database["public"]["Enums"]["order_kind"]
          order_no?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_list_id: string
          shift_id: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          client_uuid?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          debt_amount?: number
          discount_order?: number
          due_date?: string | null
          id?: string
          note?: string | null
          order_kind?: Database["public"]["Enums"]["order_kind"]
          order_no?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_list_id?: string
          shift_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_price_list"
            columns: ["price_list_id", "store_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "fk_orders_shift"
            columns: ["shift_id", "store_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          ref_no: string | null
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          ref_no?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          ref_no?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_order"
            columns: ["order_id", "store_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          price_list_id: string
          price_per_base_unit: number
          product_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          price_list_id: string
          price_per_base_unit: number
          product_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          price_list_id?: string
          price_per_base_unit?: number
          product_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pli_price_list"
            columns: ["price_list_id", "store_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["price_list_kind"]
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["price_list_kind"]
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["price_list_kind"]
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_barcodes: {
        Row: {
          barcode: string
          created_at: string
          created_by: string | null
          id: string
          source: Database["public"]["Enums"]["barcode_source"]
          variant_id: string
        }
        Insert: {
          barcode: string
          created_at?: string
          created_by?: string | null
          id?: string
          source: Database["public"]["Enums"]["barcode_source"]
          variant_id: string
        }
        Update: {
          barcode?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source?: Database["public"]["Enums"]["barcode_source"]
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_uoms: {
        Row: {
          created_at: string
          created_by: string | null
          factor: number
          product_id: string
          uom_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          factor: number
          product_id: string
          uom_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          factor?: number
          product_id?: string
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_uoms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_uoms_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attr_color: string | null
          attr_note: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          product_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          variant_code: string
        }
        Insert: {
          attr_color?: string | null
          attr_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          product_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          variant_code: string
        }
        Update: {
          attr_color?: string | null
          attr_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          product_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          variant_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_uom_id: string
          brand: string | null
          created_at: string
          created_by: string | null
          default_supplier_id: string | null
          description: string | null
          id: string
          image_url: string | null
          item_group_id: string
          name: string
          name_normalized: string | null
          safety_stock: number
          sku: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          base_uom_id: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_group_id: string
          name: string
          name_normalized?: string | null
          safety_stock?: number
          sku: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          base_uom_id?: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          default_supplier_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_group_id?: string
          name?: string
          name_normalized?: string | null
          safety_stock?: number
          sku?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_base_uom_id_fkey"
            columns: ["base_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_item_group_id_fkey"
            columns: ["item_group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receipt_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          order_id: string
          receipt_id: string
          store_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          order_id: string
          receipt_id: string
          store_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          order_id?: string
          receipt_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_receipt_allocations_order"
            columns: ["order_id", "store_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "fk_receipt_allocations_receipt"
            columns: ["receipt_id", "store_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "receipt_allocations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          client_uuid: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: Database["public"]["Enums"]["receipt_method"]
          note: string | null
          receipt_date: string
          receipt_no: string
          source_return_id: string | null
          store_id: string
          total_amount: number
        }
        Insert: {
          client_uuid: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method: Database["public"]["Enums"]["receipt_method"]
          note?: string | null
          receipt_date?: string
          receipt_no: string
          source_return_id?: string | null
          store_id: string
          total_amount: number
        }
        Update: {
          client_uuid?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: Database["public"]["Enums"]["receipt_method"]
          note?: string | null
          receipt_date?: string
          receipt_no?: string
          source_return_id?: string | null
          store_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_receipts_source_return"
            columns: ["source_return_id", "store_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          condition: Database["public"]["Enums"]["return_condition"]
          created_at: string
          id: string
          order_item_id: string
          qty_base: number
          refund_amount: number
          return_id: string
          store_id: string
          variant_id: string
        }
        Insert: {
          condition: Database["public"]["Enums"]["return_condition"]
          created_at?: string
          id?: string
          order_item_id: string
          qty_base: number
          refund_amount?: number
          return_id: string
          store_id: string
          variant_id: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["return_condition"]
          created_at?: string
          id?: string
          order_item_id?: string
          qty_base?: number
          refund_amount?: number
          return_id?: string
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_return_items_order_item"
            columns: ["order_item_id", "store_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "fk_return_items_return"
            columns: ["return_id", "store_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "return_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          client_uuid: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          refund_method: Database["public"]["Enums"]["refund_method"]
          return_date: string
          return_no: string
          store_id: string
          total_refund: number
        }
        Insert: {
          client_uuid: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          refund_method: Database["public"]["Enums"]["refund_method"]
          return_date?: string
          return_no: string
          store_id: string
          total_refund?: number
        }
        Update: {
          client_uuid?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          refund_method?: Database["public"]["Enums"]["refund_method"]
          return_date?: string
          return_no?: string
          store_id?: string
          total_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_returns_order"
            columns: ["order_id", "store_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          qty_base: number
          store_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          qty_base?: number
          store_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          qty_base?: number
          store_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          qty_base: number
          ref_id: string
          ref_type: Database["public"]["Enums"]["stock_ref_type"]
          store_id: string
          unit_cost: number | null
          variant_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          qty_base: number
          ref_id: string
          ref_type: Database["public"]["Enums"]["stock_ref_type"]
          store_id: string
          unit_cost?: number | null
          variant_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          qty_base?: number
          ref_id?: string
          ref_type?: Database["public"]["Enums"]["stock_ref_type"]
          store_id?: string
          unit_cost?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_take_items: {
        Row: {
          counted_qty: number | null
          created_at: string
          diff: number | null
          id: string
          store_id: string
          system_qty: number | null
          take_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          counted_qty?: number | null
          created_at?: string
          diff?: number | null
          id?: string
          store_id: string
          system_qty?: number | null
          take_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          counted_qty?: number | null
          created_at?: string
          diff?: number | null
          id?: string
          store_id?: string
          system_qty?: number | null
          take_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_take_items_take"
            columns: ["take_id", "store_id"]
            isOneToOne: false
            referencedRelation: "stock_takes"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "stock_take_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_take_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_takes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_group_id: string | null
          kind: Database["public"]["Enums"]["stock_take_kind"]
          note: string | null
          status: Database["public"]["Enums"]["stock_take_status"]
          store_id: string
          submitted_at: string | null
          take_date: string
          take_no: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_group_id?: string | null
          kind: Database["public"]["Enums"]["stock_take_kind"]
          note?: string | null
          status?: Database["public"]["Enums"]["stock_take_status"]
          store_id: string
          submitted_at?: string | null
          take_date?: string
          take_no: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_group_id?: string | null
          kind?: Database["public"]["Enums"]["stock_take_kind"]
          note?: string | null
          status?: Database["public"]["Enums"]["stock_take_status"]
          store_id?: string
          submitted_at?: string | null
          take_date?: string
          take_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_takes_item_group_id_fkey"
            columns: ["item_group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_takes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          created_at: string
          created_by: string | null
          role: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["store_role"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          allow_negative_stock: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          receipt_footer: string | null
          return_window_days: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_negative_stock?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          receipt_footer?: string | null
          return_window_days?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_negative_stock?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          receipt_footer?: string | null
          return_window_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      supplier_payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          inbound_receipt_id: string
          store_id: string
          supplier_payment_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          inbound_receipt_id: string
          store_id: string
          supplier_payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          inbound_receipt_id?: string
          store_id?: string
          supplier_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_spa_payment"
            columns: ["supplier_payment_id", "store_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "fk_spa_receipt"
            columns: ["inbound_receipt_id", "store_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          client_uuid: string
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["supplier_payment_method"]
          note: string | null
          payment_date: string
          payment_no: string
          store_id: string
          supplier_id: string
          total_amount: number
        }
        Insert: {
          client_uuid: string
          created_at?: string
          created_by?: string | null
          id?: string
          method: Database["public"]["Enums"]["supplier_payment_method"]
          note?: string | null
          payment_date?: string
          payment_no: string
          store_id: string
          supplier_id: string
          total_amount: number
        }
        Update: {
          client_uuid?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["supplier_payment_method"]
          note?: string | null
          payment_date?: string
          payment_no?: string
          store_id?: string
          supplier_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          name_normalized: string | null
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_normalized?: string | null
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_normalized?: string | null
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uoms: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_current_prices: {
        Row: {
          effective_from: string | null
          price_list_id: string | null
          price_per_base_unit: number | null
          product_id: string | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pli_price_list"
            columns: ["price_list_id", "store_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_assert_stock_integrity: {
        Args: { p_store?: string }
        Returns: {
          balance_qty: number
          ledger_sum: number
          store_id: string
          variant_id: string
        }[]
      }
      fn_assert_store_member: { Args: { p_store: string }; Returns: undefined }
      fn_is_any_owner: { Args: never; Returns: boolean }
      fn_is_owner: { Args: { p_store: string }; Returns: boolean }
      fn_my_store_ids: { Args: never; Returns: string[] }
      fn_next_doc_no: {
        Args: { p_store: string; p_type: string }
        Returns: string
      }
      fn_shift_expected_cash: { Args: { p_shift: string }; Returns: number }
      fn_today_vn: { Args: never; Returns: string }
      fn_unaccent_lower: { Args: { p_text: string }; Returns: string }
      rpc_cash_txn: { Args: { p_payload: Json }; Returns: Json }
      rpc_close_shift: { Args: { p_payload: Json }; Returns: Json }
      rpc_current_shift: { Args: { p_payload: Json }; Returns: Json }
      rpc_open_shift: { Args: { p_payload: Json }; Returns: Json }
      rpc_rebuild_stock_balances: { Args: { p_store: string }; Returns: Json }
    }
    Enums: {
      barcode_source: "manufacturer" | "internal"
      cash_txn_source: "manual" | "receipt" | "return" | "supplier_payment"
      cash_txn_type: "in" | "out"
      customer_group: "retail" | "wholesale"
      entity_status: "active" | "inactive"
      inbound_status: "submitted" | "void"
      order_kind: "retail" | "wholesale"
      order_status: "held" | "paid" | "void"
      payment_method: "cash" | "transfer" | "debt"
      payment_status: "paid" | "partial" | "unpaid"
      price_list_kind: "retail" | "wholesale"
      receipt_method: "cash" | "transfer" | "credit"
      refund_method: "cash" | "transfer" | "credit_next_order"
      return_condition: "intact" | "damaged"
      shift_status: "open" | "closed"
      stock_ref_type:
        | "opening"
        | "sale"
        | "purchase"
        | "return_in"
        | "return_scrap"
        | "adjust"
        | "void"
      stock_take_kind: "opening" | "periodic"
      stock_take_status: "draft" | "submitted"
      store_role: "owner" | "staff"
      supplier_payment_method: "cash" | "transfer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      barcode_source: ["manufacturer", "internal"],
      cash_txn_source: ["manual", "receipt", "return", "supplier_payment"],
      cash_txn_type: ["in", "out"],
      customer_group: ["retail", "wholesale"],
      entity_status: ["active", "inactive"],
      inbound_status: ["submitted", "void"],
      order_kind: ["retail", "wholesale"],
      order_status: ["held", "paid", "void"],
      payment_method: ["cash", "transfer", "debt"],
      payment_status: ["paid", "partial", "unpaid"],
      price_list_kind: ["retail", "wholesale"],
      receipt_method: ["cash", "transfer", "credit"],
      refund_method: ["cash", "transfer", "credit_next_order"],
      return_condition: ["intact", "damaged"],
      shift_status: ["open", "closed"],
      stock_ref_type: [
        "opening",
        "sale",
        "purchase",
        "return_in",
        "return_scrap",
        "adjust",
        "void",
      ],
      stock_take_kind: ["opening", "periodic"],
      stock_take_status: ["draft", "submitted"],
      store_role: ["owner", "staff"],
      supplier_payment_method: ["cash", "transfer"],
    },
  },
} as const
