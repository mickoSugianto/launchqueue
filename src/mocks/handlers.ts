import { http, HttpResponse, delay } from "msw";
import { mockCampaign, mockShippingRates } from "./data";
import { Order } from "../types";

export const handlers = [
  // 1. FETCH CAMPAIGN ENDPOINT
  http.get("/api/campaigns/:slug", async ({ params }) => {
    await delay(800); // 1. Simulating real-world latency

    if (params.slug !== mockCampaign.slug) {
      return HttpResponse.json({ message: "Not Found" }, { status: 404 }); // 2. Returning the data
    }

    // CHAOS SIMULATOR
    const now = new Date();
    const dropDate = new Date(mockCampaign.dropDate);

    // IF THE DROP IS LIVE, SIMULATE HIGH CONCURRENCY TRAFFIC
    if (now >= dropDate) {
      mockCampaign.variants.forEach((variant) => {
        if (variant.availableInventory > 0) {
          const ghostPurchases = Math.floor(Math.random() * 4);
          variant.availableInventory = Math.max(
            0,
            variant.availableInventory - ghostPurchases,
          );
        }
      });
    }

    return HttpResponse.json(mockCampaign);
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

    return HttpResponse.json(newOrder);
  }),
];
