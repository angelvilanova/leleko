export type UserRole = 'admin' | 'operator';

export type OrderStatus = 'pending' | 'dispatched' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  created_by: string;
  dispatched_by: string | null;
  customer_id?: string | null;   // <-- add
  created_at: string;
  dispatched_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: (OrderItem & { products: Product })[];
  profiles: Profile;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}