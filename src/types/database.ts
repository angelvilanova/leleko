export type UserRole = 'admin' | 'operator';

export type OrderStatus = 'awaiting_approval' | 'pending' | 'dispatched' | 'cancelled';

export type OrderOrigin = 'admin' | 'customer_link';
export type ApprovalMode = 'manual' | 'auto';
export type PaymentMethod = 'on_delivery' | 'pix';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'expired';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  stock_quantity: number;
  price: number;
  cost_price: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;

  // código secreto que forma o link próprio do cliente (/pedido/<link_token>)
  link_token?: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  created_by: string | null;
  dispatched_by: string | null;
  customer_id: string | null;
  cash_date?: string | null;
  notes?: string | null;
  created_at: string;
  dispatched_at: string | null;

  // pedidos pelo link do cliente e fluxo de aprovação
  origin?: OrderOrigin;
  approved_at?: string | null;
  approval_mode?: ApprovalMode | null;

  // pagamento (preparado para a etapa do Pix)
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  pix_txid?: string | null;
  paid_at?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;

  // preço no momento da venda
  unit_price: number;

  // custo no momento da venda
  unit_cost: number;

  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: (OrderItem & {
    products: Product | null;
  })[];

  profiles?: Profile | null;
  customers?: Customer | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}
