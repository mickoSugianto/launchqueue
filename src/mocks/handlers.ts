import { http, HttpResponse, delay } from "msw";
import { mockCampaign, mockShippingRates, colorImageMap } from "./data";
import { Order, ProductVariant, OrderStatus } from "../types";
import { get } from "http";

// LOCALSTORAGE
const IS_BROWSER = typeof window !== "undefined";

const globalStore = globalThis as any;
if (!globalStore.dbCampaign) {
  globalStore.dbCampaign = JSON.parse(JSON.stringify(mockCampaign));
}

// THE SEED DATA
const defaultOrders: Order[] = [
  {
    id: "debug_123",
    campaignId: "camp_kith_001",
    variantId: "var_kith_blk_l",
    status: "IN_PRODUCTION",

    totalPcs: 1,
    totalWeightKG: 0.8,

    subtotal: 2500000,
    shippingFee: 9000,
    totalAmount: 2550000,

    lockedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 100000000).toISOString(),

    customer: {
      fullName: "Developer Mode",
      email: "dev@launchqueue.com",
      whatsapp: "08123456789",
      shippingAddress: "Jl. Sudirman Kav 21",
      city: "Jakarta",
      postalCode: "12190",
    },

    item: {
      name: "Kith Drop",
      color: "Black",
      size: "L",
      heroImage:
        "https://kith.com/cdn/shop/files/KHM034254-001-Front_125bfc94-5392-4b20-9e2b-db8b433fd562.jpg?v=1762458654&width=1440",
    },
  },
];

const getOrders = (): Order[] => {
  if (IS_BROWSER) {
    const stored = localStorage.getItem("dbOrders");
    if (stored) return JSON.parse(stored);

    // IF EMPTY, SEED IT WITH DEBUG ORDER
    localStorage.setItem("dbOrders", JSON.stringify(defaultOrders));
    return defaultOrders;
  }

  // FALLBACK FOR SSR
  if (!globalStore.dbOrders) globalStore.dbOrders = [...defaultOrders];
  return globalStore.dbOrders;
};

const saveOrderList = (newOrders: Order[]) => {
  if (IS_BROWSER) {
    localStorage.setItem("dbOrders", JSON.stringify(newOrders));
  } else {
    globalStore.dbOrders = newOrders;
  }
};

export const handlers = [
  // 1. FETCH CAMPAIGN ENDPOINT
  http.get("/api/campaigns/:slug", async ({ params }) => {
    await delay(800);

    const dbCampaign = globalStore.dbCampaign;

    if (params.slug !== dbCampaign.slug) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 });
    }

    // CHAOS SIMULATOR
    const now = new Date();
    const dropDate = new Date(dbCampaign.dropDate);

    // IF THE DROP IS LIVE, SIMULATE HIGH CONCURRENCY TRAFFIC
    if (now >= dropDate) {
      dbCampaign.variants.forEach((variant: ProductVariant) => {
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

    const body = (await request.json()) as { variantId: string; city: string };

    const dbCampaign = globalStore.dbCampaign;
    const variant = dbCampaign.variants.find(
      (v: ProductVariant) => v.id === body.variantId,
    );

    // THE RACE CONDITION CHECK
    if (!variant || variant.availableInventory <= 0) {
      return HttpResponse.json({ error: "SOLD_OUT" }, { status: 409 });
    }

    // THE TIME SECURITY CHECK (Never trust the client!)
    if (new Date() < new Date(dbCampaign.dropDate)) {
      return HttpResponse.json({ error: "DROP_NOT_ACTIVE" }, { status: 403 });
    }

    // LOCK THE INVENTORY
    variant.availableInventory -= 1;

    const shippingFee = mockShippingRates[body.city] || 25000;

    // CREATING THE TEMPORARY RECEIPT
    const newOrder: Order = {
      id: `ord_${Math.random().toString(36).slice(2, 9)}`,
      campaignId: dbCampaign.id,
      variantId: variant.id,
      status: "AWAITING_PAYMENT",
      totalPcs: 1,
      totalWeightKG: variant.weightKG,
      subtotal: variant.price,
      shippingFee: shippingFee,
      totalAmount: variant.price + shippingFee,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      customer: {
        fullName: "",
        email: "",
        whatsapp: "",
        shippingAddress: "",
        city: body.city,
        postalCode: "",
      },
      item: {
        name: dbCampaign.title || "Kith Drop",
        color: variant.color,
        size: variant.size,
        heroImage: colorImageMap[variant.color],
      },
    };

    // DUAL-STORAGE
    const orders = getOrders();
    orders.push(newOrder);
    saveOrderList(orders);

    return HttpResponse.json(newOrder);
  }),

  // 4. THE HYDRATION ENDPOINT (GET CHECKOUT SESSION)
  http.get("/api/checkout/:sessionId", async ({ params }) => {
    await delay(500);

    // FIND THE ORDER IN OUR DATABASE
    const order = getOrders().find((o) => o.id === params.sessionId);

    if (!order) {
      return HttpResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    // SECURITY: ENSURE THE 15-MINUTE TIMER HASN'T EXPIRED
    if (new Date() > new Date(order.expiresAt)) {
      order.status = "EXPIRED";
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    return HttpResponse.json(order);
  }),

  // 5. THE FINALIZATION ENDPOINT (PROCESS PAYMENT & COMPLETE ORDER)
  http.post("/api/checkout/complete", async ({ request }) => {
    await delay(1500);

    const body = (await request.json()) as any;
    const { sessionId, shippingDetails } = body;

    // FETCH THE PERSISTENT DATABASE
    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === sessionId);
    const order = orders[orderIndex];

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    // SECURITY CHECK: MAKE SURE IT HASN'T EXPIRED WHILE THEY WERE TYPING
    if (new Date() > new Date(order.expiresAt)) {
      order.status = "EXPIRED";
      saveOrderList(orders);
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    // FINALIZE THE ORDER
    order.status = "PAYMENT_VERIFIED";
    order.customer = shippingDetails;

    // RECALCULATE THE SHIPPING FEE BASED ON THE SUBMITTED CITY
    const finalCity = shippingDetails.city;
    const finalShippingFee = mockShippingRates[finalCity] ?? 25000;

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
    return HttpResponse.json(getOrders());
  }),

  // 7. ADMIN : MUTATE ORDER STATUS
  http.patch("/api/admin/orders/:id", async ({ params, request }) => {
    await delay(800);

    const body = (await request.json()) as { status: OrderStatus };
    const { status } = body;

    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === params.id);
    const order = orders[orderIndex];

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    // MUTATE THE GLOBAL STORE
    order.status = status;

    // UPDATE THE CHANGE TO LOCALSTORAGE
    saveOrderList(orders);

    return HttpResponse.json({ success: true, order });
  }),
];
