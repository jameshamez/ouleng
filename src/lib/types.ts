export type Station = "somtam" | "cafe";
export type Zone = "indoor" | "canal";

export interface OptionChoice {
  label: string;
  price: number;
}

export interface OptionGroup {
  name: string;
  required: boolean;
  multi: boolean;
  choices: OptionChoice[];
}

export interface MenuCategory {
  id: string;
  name: string;
  emoji: string;
  sort: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  emoji: string;
  station: Station;
  is_available: boolean;
  is_signature: boolean;
  options: OptionGroup[];
  sort: number;
}

export interface Table {
  id: string;
  code: string;
  zone: Zone;
  seats: number;
  // Position on the floor plan, in grid cells (see FLOOR_COLS / FLOOR_ROWS).
  x: number;
  y: number;
  w: number;
  h: number;
  shape: "round" | "square";
  /** false = removed from the floor (kept so old bills still resolve). */
  active: boolean;
}

export type DecorKind = "area" | "canal" | "stage" | "screen" | "counter" | "kitchen" | "entrance";

/** Non-bookable landmarks drawn on the floor plan. */
export interface FloorDecor {
  id: string;
  kind: DecorKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BookingStatus = "pending" | "confirmed" | "rejected" | "seated" | "cancelled";

export interface Booking {
  id: string;
  line_user_id: string;
  name: string;
  phone: string;
  party_size: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  zone: Zone;
  note: string;
  status: BookingStatus;
  table_id: string | null;
  created_at: string;
}

export type SessionStatus = "open" | "bill_requested" | "paid";

export interface DiningSession {
  id: string;
  table_id: string;
  booking_id: string | null;
  status: SessionStatus;
  opened_at: string;
  closed_at: string | null;
}

export type OrderType = "dine_in" | "takeaway" | "preorder";
export type OrderStatus =
  | "awaiting_payment"
  | "placed"
  | "ready"
  | "picked_up"
  | "cancelled";

export interface Order {
  id: string;
  type: OrderType;
  session_id: string | null;
  booking_id: string | null;
  line_user_id: string;
  customer_name: string;
  pickup_time: string | null;
  status: OrderStatus;
  note: string;
  created_at: string;
}

export type ItemStatus = "held" | "queued" | "cooking" | "ready" | "served" | "cancelled";

export interface SelectedOption {
  group: string;
  label: string;
  price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  unit_price: number;
  qty: number;
  options: SelectedOption[];
  note: string;
  station: Station;
  status: ItemStatus;
  created_at: string;
}

export type PaymentStatus = "pending" | "verified" | "rejected";

export interface Payment {
  id: string;
  target_type: "session" | "order";
  target_id: string;
  amount: number;
  method: "promptpay" | "cash";
  slip_url: string | null;
  status: PaymentStatus;
  created_at: string;
  verified_at: string | null;
}

export interface Customer {
  id: string; // LINE userId
  display_name: string;
  picture_url: string | null;
}

export interface Tables {
  menu_categories: MenuCategory;
  menu_items: MenuItem;
  tables: Table;
  floor_decor: FloorDecor;
  bookings: Booking;
  dining_sessions: DiningSession;
  orders: Order;
  order_items: OrderItem;
  payments: Payment;
  customers: Customer;
}

export type TableName = keyof Tables;

/** What the customer sends when adding an item to the cart / placing an order. */
export interface CartLine {
  menu_item_id: string;
  qty: number;
  options: SelectedOption[];
  note: string;
}
