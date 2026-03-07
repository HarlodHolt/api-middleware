export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  created_at: string;
  status: OrderStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_country?: string;
  address_state?: string;
  address_suburb?: string;
  address_postcode?: string;
  address_line1?: string;
  address_line2?: string | null;
  delivery_zone_key?: string | null;
  delivery_address_line1: string;
  delivery_address_line2?: string | null;
  delivery_suburb: string;
  delivery_state: string;
  delivery_postcode: string;
  delivery_date: string;
  gift_message?: string | null;
  customer_notes?: string | null;
  delivery_notes?: string | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_provider?: 'manual' | 'stripe_checkout' | null;
  payment_status?: 'pending' | 'paid' | 'failed' | 'cancelled' | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  order_stock_restored?: number; // Admin specific, safe as optional
  customer_email_status?: 'pending' | 'sent' | 'failed';
  admin_email_status?: 'pending' | 'sent' | 'failed';
}

export interface OrderItem {
  id: string;
  order_id: string;
  collection_id: string;
  collection_name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

export type OrderWithItems = Order & {
  items: OrderItem[];
};

export interface DeliveryZone {
  id: string;
  zone_key?: string | null;
  state?: string | null;
  country?: string | null;
  suburb: string;
  fee_cents: number;
  active: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  published: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
