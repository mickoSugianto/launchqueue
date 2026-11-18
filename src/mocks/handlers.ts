import { http, HttpResponse, delay } from "msw";
import { mockCampaign, mockShippingRates } from "./data";
import { Order, OrderStatus, Campaign, Customer } from "../types";
import { ORDER_STATUS_FLOW } from "@/lib/constants";

// LOCALSTORAGE
const IS_BROWSER = typeof window !== "undefined";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalStore = globalThis as any;
if (!globalStore.dbCampaigns) {
  globalStore.dbCampaigns = deepClone(mockCampaign);
}

if (IS_BROWSER) {
  try {
    localStorage.removeItem("dbCampaigns");
  } catch {
    // Ignore storage access errors
  }
}

// THE SEED DATA
const defaultOrders: Order[] = [
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

    lockedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),

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

const getCampaigns = (): Campaign[] => {
  if (!globalStore.dbCampaigns) {
    globalStore.dbCampaigns = deepClone(mockCampaign);
  }
  return globalStore.dbCampaigns as Campaign[];
};

const getOrders = (): Order[] => {
  if (IS_BROWSER) {
    const stored = localStorage.getItem("dbOrders");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed as Order[];
        }
      } catch {
        // Re-seed corrupted storage below
      }
    }

    // IF EMPTY OR CORRUPTED, SEED IT WITH DEBUG ORDER
    const seeded = deepClone(defaultOrders);
    localStorage.setItem("dbOrders", JSON.stringify(seeded));
    return seeded;
  }

  // FALLBACK FOR SSR / TESTS
  if (!globalStore.dbOrders) {
    globalStore.dbOrders = deepClone(defaultOrders);
  }
  return globalStore.dbOrders as Order[];
};

const saveOrderList = (newOrders: Order[]) => {
  if (IS_BROWSER) {
    localStorage.setItem("dbOrders", JSON.stringify(newOrders));
  } else {
    globalStore.dbOrders = newOrders;
  }
};

const reclaimVariantStock = (order: Order) => {
  const campaign = getCampaigns().find((c) => c.id === order.campaignId);
  const variant = campaign?.variants.find((v) => v.id === order.variantId);
  if (variant) {
    variant.availableInventory = Math.min(
      variant.totalInventory,
      variant.availableInventory + (order.totalPcs || 1),
    );
  }
};

const expireOrderIfNeeded = (orders: Order[], orderIndex: number): boolean => {
  const order = orders[orderIndex];
  if (!order || order.status !== "AWAITING_PAYMENT") {
    return false;
  }

  if (Date.now() >= new Date(order.expiresAt).getTime()) {
    order.status = "EXPIRED";
    reclaimVariantStock(order);
    saveOrderList(orders);
    return true;
  }

  return false;
};

const sweepExpiredOrders = (): Order[] => {
  const orders = getOrders();
  const now = Date.now();
  let changed = false;

  for (const order of orders) {
    if (
      order.status === "AWAITING_PAYMENT" &&
      now >= new Date(order.expiresAt).getTime()
    ) {
      order.status = "EXPIRED";
      reclaimVariantStock(order);
      changed = true;
    }
  }

  if (changed) {
    saveOrderList(orders);
  }

  return orders;
};

export const handlers = [
  // HOMEPAGE: GET ALL CAMPAIGNS
  http.get("/api/campaigns", async () => {
    await delay(500);
    sweepExpiredOrders();

    return HttpResponse.json(getCampaigns());
  }),

  // 1. FETCH CAMPAIGN ENDPOINT
  http.get("/api/campaigns/:slug", async ({ params }) => {
    await delay(800);
    sweepExpiredOrders();

    const dbCampaign = getCampaigns().find((c) => c.slug === params.slug);

    if (!dbCampaign) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 });
    }

    // CHAOS SIMULATOR
    const now = new Date();
    const dropDate = new Date(dbCampaign.dropDate);

    // IF THE DROP IS LIVE, SIMULATE HIGH CONCURRENCY TRAFFIC
    if (now >= dropDate) {
      dbCampaign.variants.forEach((variant) => {
        if (variant.availableInventory > 0) {
          const ghostPurchases = Math.floor(Math.random() * 4);
          variant.availableInventory = Math.max(
            0,
            variant.availableInventory - ghostPurchases,
          );
        }
      });
    }

    return HttpResponse.json(dbCampaign);
  }),

  // 2. FETCH SHIPPING RATES
  http.get("/api/shipping-rates", async () => {
    return HttpResponse.json(mockShippingRates);
  }),

  // 3. THE INVENTORY LOCK ENDPOINT
  http.post("/api/checkout/lock", async ({ request }) => {
    await delay(1200);

    let body: { slug?: string; variantId?: string; city?: string } | null =
      null;
    try {
      body = (await request.json()) as {
        slug?: string;
        variantId?: string;
        city?: string;
      };
    } catch {
      return HttpResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    if (
      !body ||
      typeof body.slug !== "string" ||
      typeof body.variantId !== "string"
    ) {
      return HttpResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const orders = sweepExpiredOrders();

    const dbCampaign = getCampaigns().find((c) => c.slug === body.slug);
    if (!dbCampaign || !dbCampaign.isActive) {
      return HttpResponse.json(
        { error: "CAMPAIGN_NOT_FOUND" },
        { status: 404 },
      );
    }

    const variant = dbCampaign.variants.find((v) => v.id === body.variantId);
    if (!variant) {
      return HttpResponse.json({ error: "VARIANT_NOT_FOUND" }, { status: 404 });
    }

    // THE RACE CONDITION CHECK
    if (variant.availableInventory <= 0) {
      return HttpResponse.json({ error: "SOLD_OUT" }, { status: 409 });
    }

    // THE TIME SECURITY CHECK
    if (Date.now() < new Date(dbCampaign.dropDate).getTime()) {
      return HttpResponse.json({ error: "DROP_NOT_ACTIVE" }, { status: 403 });
    }

    // ANTI-SCALPING: LIMIT ACTIVE UNPAID LOCKS PER CAMPAIGN
    const activeHolds = orders.filter(
      (o) =>
        o.id !== "debug_123" &&
        o.campaignId === dbCampaign.id &&
        o.status === "AWAITING_PAYMENT",
    ).length;

    if (activeHolds >= variant.maxPurchase) {
      return HttpResponse.json(
        { error: "MAX_PURCHASE_EXCEEDED" },
        { status: 409 },
      );
    }

    // LOCK THE INVENTORY
    variant.availableInventory -= 1;

    const city = typeof body.city === "string" ? body.city : "Jakarta";
    const shippingFee = Object.prototype.hasOwnProperty.call(
      mockShippingRates,
      city,
    )
      ? mockShippingRates[city]
      : 25000;

    // CREATING THE TEMPORARY RECEIPT
    const newOrder: Order = {
      id: `ord_${Math.random().toString(36).slice(2, 9)}`,
      campaignId: dbCampaign.id,
      variantId: variant.id,
      status: "AWAITING_PAYMENT",
      totalPcs: 1,
      totalWeightKG: variant.weightKG,
      subtotal: variant.price,
      shippingFee,
      totalAmount: variant.price + shippingFee,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      customer: {
        fullName: "",
        email: "",
        whatsapp: "",
        shippingAddress: "",
        city,
        postalCode: "",
      },
      item: {
        name: dbCampaign.title || "Kith Drop",
        color: variant.color,
        size: variant.size,
        heroImage:
          dbCampaign.previewImages[variant.color] ||
          dbCampaign.heroImages?.[0] ||
          "",
      },
    };

    orders.push(newOrder);
    saveOrderList(orders);

    return HttpResponse.json(newOrder);
  }),

  // 4. THE HYDRATION ENDPOINT (GET CHECKOUT SESSION)
  http.get("/api/checkout/:sessionId", async ({ params }) => {
    await delay(500);

    // FIND THE ORDER IN OUR DATABASE
    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === params.sessionId);

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    // SECURITY: EXPIRE ONLY AWAITING_PAYMENT ORDERS PAST expiresAt
    expireOrderIfNeeded(orders, orderIndex);
    const order = orders[orderIndex];

    if (order.status === "EXPIRED") {
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    return HttpResponse.json(order);
  }),

  // 5. THE FINALIZATION ENDPOINT (PROCESS PAYMENT & COMPLETE ORDER)
  http.post("/api/checkout/complete", async ({ request }) => {
    await delay(1500);

    let body: { sessionId?: string; shippingDetails?: Customer } | null = null;
    try {
      body = (await request.json()) as {
        sessionId?: string;
        shippingDetails?: Customer;
      };
    } catch {
      return HttpResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const sessionId = body?.sessionId;
    const shippingDetails = body?.shippingDetails;

    if (!sessionId || typeof sessionId !== "string") {
      return HttpResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    // FETCH THE PERSISTENT DATABASE
    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === sessionId);

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    // SECURITY CHECK: MAKE SURE IT HASN'T EXPIRED WHILE THEY WERE TYPING
    expireOrderIfNeeded(orders, orderIndex);
    const order = orders[orderIndex];

    if (order.status === "EXPIRED") {
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    if (order.status !== "AWAITING_PAYMENT") {
      return HttpResponse.json(
        {
          error: "ORDER_ALREADY_COMPLETED",
          receiptUrl: `/receipt/${order.id}`,
        },
        { status: 409 },
      );
    }

    const finalCity = shippingDetails?.city;
    if (
      !shippingDetails ||
      !finalCity ||
      !Object.prototype.hasOwnProperty.call(mockShippingRates, finalCity)
    ) {
      return HttpResponse.json(
        { error: "INVALID_SHIPPING_DETAILS" },
        { status: 400 },
      );
    }

    // FINALIZE THE ORDER
    order.status = "PAYMENT_VERIFIED";
    order.customer = shippingDetails;

    // RECALCULATE THE SHIPPING FEE BASED ON THE SUBMITTED CITY
    const finalShippingFee = mockShippingRates[finalCity];
    order.shippingFee = finalShippingFee;
    order.totalAmount = order.subtotal + finalShippingFee;

    // SAVE THE UPDATED DATABASE
    saveOrderList(orders);

    // RETURN THE SUCCESS RECEIPT
    return HttpResponse.json({
      success: true,
      receiptUrl: `/receipt/${sessionId}`,
    });
  }),

  // 6. ADMIN: FETCH ALL ORDERS
  http.get("/api/admin/orders", async () => {
    await delay(400);
    return HttpResponse.json(sweepExpiredOrders());
  }),

  // 7. ADMIN: MUTATE ORDER STATUS
  http.patch("/api/admin/orders/:id", async ({ params, request }) => {
    await delay(800);

    let body: { status?: OrderStatus } | null = null;
    try {
      body = (await request.json()) as { status?: OrderStatus };
    } catch {
      return HttpResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const status = body?.status;

    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === params.id);

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    const order = orders[orderIndex];
    if (!status || ORDER_STATUS_FLOW[order.status] !== status) {
      return HttpResponse.json(
        { error: "INVALID_STATUS_TRANSITION" },
        { status: 409 },
      );
    }

    // MUTATE THE GLOBAL STORE
    order.status = status;

    // UPDATE THE CHANGE TO LOCALSTORAGE
    saveOrderList(orders);

    return HttpResponse.json({ success: true, order });
  }),
];
