import type { OrderStatus } from "@/types";

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  AWAITING_PAYMENT: null,
  PAYMENT_VERIFIED: "IN_PRODUCTION",
  IN_PRODUCTION: "READY_TO_SHIP",
  READY_TO_SHIP: "SHIPPED",
  SHIPPED: null,
  EXPIRED: null,
  CANCELLED: null,
};

export const SUPPORTED_CITIES = [
  "Jakarta",
  "Bandung",
  "Surabaya",
  "Bali",
  "Medan",
] as const;

export function formatOrderDisplayCode(id: string): string {
  const parts = id.split("_");
  return (parts.length > 1 ? parts.slice(1).join("_") : id).toUpperCase();
}
