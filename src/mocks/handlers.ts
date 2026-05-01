import { http, HttpResponse, delay } from "msw";
import { mockCampaign, mockShippingRates, colorImageMap } from "./data";
import { Order } from "../types";
import { get } from "http";

// SURVIVAL DB: CREATE A DB THAT SURVIVES NEXT.JS FAST REFRESH & SSR
const globalStore = globalThis as any;
if (!globalStore.dbCampaign) {
  globalStore.dbCampaign = JSON.parse(JSON.stringify(mockCampaign));
}
if (!globalStore.dbOrders) {
  globalStore.dbOrders = [];
}

const getOrders = (): Order[] => globalStore.dbOrders;
const saveOrder = (order: Order) => globalStore.dbOrders.push(order);

export const handlers = [
  // 1. FETCH CAMPAIGN ENDPOINT
  http.get("/api/campaigns/:slug", async ({ params }) => {
    await delay(800); // 1. Simulating real-world latency

    const dbCampaign = globalStore.dbCampaign;

    if (params.slug !== dbCampaign.slug) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 }); // 2. Returning the data
    }

    // CHAOS SIMULATOR
    const now = new Date();
    const dropDate = new Date(dbCampaign.dropDate);

    // IF THE DROP IS LIVE, SIMULATE HIGH CONCURRENCY TRAFFIC
    if (now >= dropDate) {
      dbCampaign.variants.forEach((variant: any) => {
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
    await delay(1200); // Simulate a heavy database transaction

    const body = (await request.json()) as { variantId: string; city: string };
    const variant = mockCampaign.variants.find((v) => v.id === body.variantId);

    // THE RACE CONDITION CHECK
    if (!variant || variant.availableInventory <= 0) {
      return HttpResponse.json({ error: "SOLD_OUT" }, { status: 409 });
    }

    // THE TIME SECURITY CHECK (Never trust the client!)
    if (new Date() < new Date(mockCampaign.dropDate)) {
      return HttpResponse.json({ error: "DROP_NOT_ACTIVE" }, { status: 403 });
    }

    const shippingFee = mockShippingRates[body.city] || 25000;

    // CREATING THE TEMPORARY RECEIPT
    const newOrder: Order = {
      id: `ord_${Math.random().toString(36).slice(2, 9)}`,
      campaignId: mockCampaign.id,
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
        name: "",
        email: "",
        whatsapp: "",
        shippingAddress: "",
        city: body.city,
      },
    };

    // SAVE TO PERSISTENT STORAGE
    saveOrder(newOrder);

    return HttpResponse.json(newOrder);
  }),

  // 4. THE HYDRATION ENDPOINT (GET CHECKOUT SESSION)
  http.get("/api/checkout/:sessionId", async ({ params }) => {
    await delay(500);

    // FIND THE ORDER IN OUR DATABASE
    const order = getOrders().find((o) => o.id === params.sessionId);
    const dbCampaign = globalStore.dbCampaign;

    if (!order) {
      return HttpResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    // SECURITY: ENSURE THE 15-MINUTE TIMER HASN'T EXPIRED
    if (new Date() > new Date(order.expiresAt)) {
      order.status = "EXPIRED";
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    // FIND THE DEHYDRATED VARIANT IN THE CAMPAIGN
    const variant = dbCampaign.variants.find(
      (v: any) => v.id === order.variantId,
    );

    // HYDRATE, STITCH THE ORDER, VARIANT DETAILS, AND THE MAPPED IMAGE TOGETHER
    const hydratedOrder = {
      ...order,
      item: {
        name: variant.name,
        color: variant.color,
        size: variant.size,
        heroImage: colorImageMap[variant.color] || dbCampaign.heroImages[0],
      },
    };

    return HttpResponse.json(hydratedOrder);
  }),

  // 5. THE FINALIZATION ENDPOINT (PROCESS PAYMENT & COMPLETE ORDER)
  http.post("/api/checkout/complete", async ({ request }) => {
    await delay(1500);

    const body = (await request.json()) as any;
    const { sessionId, shippingDetails } = body;

    // FETCH THE PERSISTENT DATABASE
    const orders = getOrders();
    const orderIndex = orders.findIndex((o) => o.id === sessionId);

    if (orderIndex === -1) {
      return HttpResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    // SECURITY CHECK: MAKE SURE IT HASN'T EXPIRED WHILE THEY WERE TYPING
    const order = orders[orderIndex];
    if (new Date() > new Date(order.expiresAt)) {
      order.status = "EXPIRED";
      sessionStorage.setItem("dbOrders", JSON.stringify(orders));
      return HttpResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    // FINALIZE THE ORDER
    order.status = "PAYMENT_VERIFIED";
    order.customer = shippingDetails;

    // SAVE THE UPDATED DATABASE
    sessionStorage.setItem("dbOrders", JSON.stringify(orders));

    // RETURN THE SUCCESS RECEIPT
    return HttpResponse.json({
      success: true,
      receiptUrl: `/receipt/${sessionId}`,
    });
  }),
];
