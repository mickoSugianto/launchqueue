import { http, HttpResponse, delay } from "msw";
import { mockCampaign, mockShippingRates } from "./data";
import { Order, OrderStatus, Campaign, Customer } from "../types";
import { ORDER_STATUS_FLOW } from "@/lib/constants";
import {
  expireOrderIfNeeded,
  getOrders,
  saveOrderList,
  sweepExpiredOrders,
} from "@/lib/checkoutStorage";

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

const getCampaigns = (): Campaign[] => {
  if (!globalStore.dbCampaigns) {
    globalStore.dbCampaigns = deepClone(mockCampaign);
  }
  return globalStore.dbCampaigns as Campaign[];
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

export const handlers = [
  // HOMEPAGE: GET ALL CAMPAIGNS
  http.get("/api/campaigns", async () => {
    await delay(500);
    sweepExpiredOrders(reclaimVariantStock);

    return HttpResponse.json(getCampaigns());
  }),

  // 1. FETCH CAMPAIGN ENDPOINT
  http.get("/api/campaigns/:slug", async ({ params }) => {
    await delay(800);
    sweepExpiredOrders(reclaimVariantStock);

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

    const orders = sweepExpiredOrders(reclaimVariantStock);

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

  // 3B. ACTIVE CHECKOUT HOLDS ENDPOINT (REGISTERED BEFORE :sessionId)
  http.get("/api/checkout/active", async ({ request }) => {
    const orders = sweepExpiredOrders(reclaimVariantStock);
    const campaignId = request?.url
      ? new URL(request.url, "http://localhost").searchParams.get("campaignId")
      : null;

    const active = orders
      .filter(
        (o) =>
          o.id !== "debug_123" &&
          o.status === "AWAITING_PAYMENT" &&
          (!campaignId || o.campaignId === campaignId),
      )
      .sort(
        (a, b) =>
          new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime(),
      );

    return HttpResponse.json(active);
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

    // SECURITY: EXPIRE ONLY AWAITING_PAYMENT ORDERS PAST expiresAt OR 3-MIN GRACE
    expireOrderIfNeeded(orders, orderIndex, reclaimVariantStock);
    const order = orders[orderIndex];

    if (order.status === "EXPIRED") {
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    if (order.status === "CANCELLED") {
      return HttpResponse.json({ error: "SESSION_CANCELLED" }, { status: 410 });
    }

    // BUYER RESUMED CHECKOUT WITHIN 3-MIN GRACE WINDOW: CLEAR leftAt
    if (order.status === "AWAITING_PAYMENT" && order.leftAt) {
      order.leftAt = null;
      saveOrderList(orders);
    }

    return HttpResponse.json(order);
  }),

  // 4B. CANCEL / ABANDON CHECKOUT SESSION
  http.post("/api/checkout/:sessionId/cancel", async ({ params }) => {
    await delay(400);

    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === params.sessionId);

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    expireOrderIfNeeded(orders, orderIndex, reclaimVariantStock);
    const order = orders[orderIndex];

    if (order.status === "EXPIRED" || order.status === "CANCELLED") {
      return HttpResponse.json({ success: true, status: order.status });
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

    order.status = "CANCELLED";
    order.leftAt = null;
    reclaimVariantStock(order);
    saveOrderList(orders);

    return HttpResponse.json({ success: true, status: "CANCELLED" });
  }),

  // 4C. MARK CHECKOUT SESSION AS LEFT (3-MIN GRACE WINDOW)
  http.post("/api/checkout/:sessionId/leave", async ({ params }) => {
    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === params.sessionId);

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    expireOrderIfNeeded(orders, orderIndex, reclaimVariantStock);
    const order = orders[orderIndex];

    if (order.status === "EXPIRED") {
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    if (order.status === "CANCELLED") {
      return HttpResponse.json({ error: "SESSION_CANCELLED" }, { status: 410 });
    }

    if (order.status !== "AWAITING_PAYMENT") {
      return HttpResponse.json({
        success: true,
        status: order.status,
        leftAt: null,
      });
    }

    if (!order.leftAt) {
      order.leftAt = new Date(Date.now()).toISOString();
      saveOrderList(orders);
    }

    return HttpResponse.json({
      success: true,
      status: order.status,
      leftAt: order.leftAt,
    });
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

    // SECURITY CHECK: MAKE SURE IT HASN'T EXPIRED OR BEEN CANCELLED WHILE THEY WERE TYPING
    expireOrderIfNeeded(orders, orderIndex, reclaimVariantStock);
    const order = orders[orderIndex];

    if (order.status === "EXPIRED") {
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    if (order.status === "CANCELLED") {
      return HttpResponse.json({ error: "SESSION_CANCELLED" }, { status: 410 });
    }

    if (order.status !== "AWAITING_PAYMENT") {
      return HttpResponse.json(
        {
          error: "ORDER_ALREADY_COMPLETED",
          receiptUrl: `/receipt/${order.id}`,
          order,
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
    order.leftAt = null;
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
      order,
    });
  }),

  // 6. ADMIN: FETCH ALL ORDERS
  http.get("/api/admin/orders", async () => {
    await delay(400);
    return HttpResponse.json(sweepExpiredOrders(reclaimVariantStock));
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
