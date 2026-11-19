import type { Order } from "@/types";

export const CHECKOUT_GRACE_MS = 3 * 60000;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDefaultOrders(): Order[] {
  const now = Date.now();
  return [
    {
      id: "debug_123",
      campaignId: "camp_kith_jkt_001",
      variantId: "var_kith_blk_l",
      status: "IN_PRODUCTION",

      totalPcs: 1,
      totalWeightKG: 1.25,

      subtotal: 2500000,
      shippingFee: 9000,
      totalAmount: 2509000,

      lockedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 15 * 60000).toISOString(),

      customer: {
        fullName: "Developer Mode",
        email: "dev@launchqueue.com",
        whatsapp: "08123456789",
        shippingAddress: "Jl. Sudirman Kav 21",
        city: "Jakarta",
        postalCode: "12190",
      },

      item: {
        name: "Kith for the New York Knicks",
        color: "Black",
        size: "L",
        heroImage: "/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp",
      },
    },
  ];
}

export function getOrders(): Order[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("dbOrders");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed as Order[];
        }
      }
    } catch {
      // Re-seed corrupted storage below
    }

    const seeded = createDefaultOrders();
    try {
      localStorage.setItem("dbOrders", JSON.stringify(seeded));
    } catch {
      // Ignore storage write errors
    }
    return seeded;
  }

  // Fallback for SSR / non-DOM environments
  const globalStore = globalThis as { dbOrders?: Order[] };
  if (!globalStore.dbOrders) {
    globalStore.dbOrders = createDefaultOrders();
  }
  return globalStore.dbOrders;
}

export function saveOrderList(newOrders: Order[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("dbOrders", JSON.stringify(newOrders));
    } catch {
      // Ignore storage write errors
    }
  } else {
    (globalThis as { dbOrders?: Order[] }).dbOrders = newOrders;
  }
}

function applyExpiryTransition(
  order: Order,
  now: number,
  onReclaimStock?: (order: Order) => void,
): boolean {
  if (order.status !== "AWAITING_PAYMENT") {
    return false;
  }

  const expiresAtMs = new Date(order.expiresAt).getTime();
  if (Number.isFinite(expiresAtMs) && now >= expiresAtMs) {
    order.status = "EXPIRED";
    order.leftAt = null;
    onReclaimStock?.(order);
    return true;
  }

  const leftAtMs = order.leftAt ? new Date(order.leftAt).getTime() : NaN;
  if (Number.isFinite(leftAtMs) && now >= leftAtMs + CHECKOUT_GRACE_MS) {
    order.status = "CANCELLED";
    order.leftAt = null;
    onReclaimStock?.(order);
    return true;
  }

  return false;
}

export function expireOrderIfNeeded(
  orders: Order[],
  orderIndex: number,
  onReclaimStock?: (order: Order) => void,
): boolean {
  const order = orders[orderIndex];
  if (!order) return false;

  const changed = applyExpiryTransition(order, Date.now(), onReclaimStock);
  if (changed) {
    saveOrderList(orders);
  }
  return changed;
}

export function sweepExpiredOrders(
  onReclaimStock?: (order: Order) => void,
): Order[] {
  const orders = getOrders();
  const now = Date.now();
  let changed = false;

  for (const order of orders) {
    if (applyExpiryTransition(order, now, onReclaimStock)) {
      changed = true;
    }
  }

  if (changed) {
    saveOrderList(orders);
  }

  return orders;
}

/**
 * Synchronously records `leftAt` in `localStorage["dbOrders"]` when leaving
 * `/checkout/[sessionId]` without completing or explicitly cancelling.
 * Never seeds `defaultOrders` if storage is absent or corrupted.
 */
export function markCheckoutLeft(sessionId: string): void {
  if (typeof window === "undefined" || !sessionId) return;

  try {
    const stored = localStorage.getItem("dbOrders");
    if (!stored) return;

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return;

    const orders = deepClone(parsed) as Order[];
    const order = orders.find((o) => o.id === sessionId);
    if (!order || order.status !== "AWAITING_PAYMENT") return;

    const existingLeftAt = order.leftAt;
    if (existingLeftAt) {
      // Preserve initial leave timestamp so duplicate teardown hooks don't reset the 3-min clock
      return;
    }

    order.leftAt = new Date(Date.now()).toISOString();
    localStorage.setItem("dbOrders", JSON.stringify(orders));
  } catch {
    // Ignore storage/parse errors during teardown
  }
}

export function getGraceTargetMs(order: Order): number {
  const expiresAtMs = new Date(order.expiresAt).getTime();
  const leftAtMs = order.leftAt ? new Date(order.leftAt).getTime() : NaN;
  if (Number.isFinite(leftAtMs)) {
    const graceEndMs = leftAtMs + CHECKOUT_GRACE_MS;
    return Number.isFinite(expiresAtMs)
      ? Math.min(expiresAtMs, graceEndMs)
      : graceEndMs;
  }
  return expiresAtMs;
}
