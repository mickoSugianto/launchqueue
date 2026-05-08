export type OrderStatus =
  | "AWAITING_PAYMENT" // user is in the 15-minute checkout window
  | "PAYMENT_VERIFIED" // Midtrans confirmed the payment
  | "IN_PRODUCTION"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "EXPIRED"; // User didn't pay in 15 minutes, inventory released

export type ShippingRates = Record<string, number>;

export interface ProductVariant {
  id: string;
  name: string; // product name
  color: string; // e.g., "White"
  size: string; // e.g., "S" / "M", etc
  price: number; // e.g., 500000 (in Rupiah)
  totalInventory: number; // How many were physically made (e.g., 50)
  availableInventory: number; // How many left to buy right now
  weightKG: number; // to calculate the shipping fee
  maxPurchase: number; // total of allowed purchase per customer
  imageUrl?: string;
}

export interface Campaign {
  id: string; // Unique ID (e.g., "camp_123xyz")
  brandId: string; // Which brand owns this drop?
  title: string; // e.g., "Heavy Knitwear Q3 Drop"
  slug: string; // The URL path: launchqueue.com/brand/[slug]
  dropDate: string; // ISO Date String of exactly when the queue opens
  productionTime: number; // number of days
  expectedDelivery: string; // the dropDate + productionTime, ISO Date String
  isActive: boolean; // Is the drop currently live?
  heroImages: string[];
  sizeChart?: string;
  variants: ProductVariant[]; // The different sizes/colors available
}

export interface Customer {
  fullName: string;
  email: string;
  whatsapp: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
}

export interface Item {
  name: string;
  color: string;
  size: string;
  heroImage: string;
}
export interface Order {
  id: string; // e.g., "ord_9a8b7c6d" (Used for the public tracking link)
  campaignId: string; // Ties this order to the specific drop event
  variantId: string; // Exactly which size/color they bought
  status: OrderStatus; // Uses the strict State Machine

  totalPcs: number;
  totalWeightKG: number;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;

  lockedAt: string; // ISO Date String: The exact millisecond they entered checkout
  expiresAt: string; // ISO Date String: exactly 15 minutes after lockedAt

  customer: Customer;

  item: Item;
}
