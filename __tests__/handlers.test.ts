import type { Campaign, Customer, Order } from "@/types";

interface MockHandler {
  method: "GET" | "POST" | "PATCH";
  path: string;
  resolver: (ctx: {
    params: Record<string, string>;
    request: { json: () => Promise<unknown> };
  }) => Promise<{ status: number; body: unknown }>;
}

jest.mock("msw", () => ({
  __esModule: true,
  delay: jest.fn(() => Promise.resolve()),
  HttpResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    }),
  },
  http: {
    get: (path: string, resolver: MockHandler["resolver"]) => ({
      method: "GET",
      path,
      resolver,
    }),
    post: (path: string, resolver: MockHandler["resolver"]) => ({
      method: "POST",
      path,
      resolver,
    }),
    patch: (path: string, resolver: MockHandler["resolver"]) => ({
      method: "PATCH",
      path,
      resolver,
    }),
  },
}));

function getGlobalCampaigns(): Campaign[] {
  return (globalThis as { dbCampaigns?: Campaign[] }).dbCampaigns ?? [];
}

function loadHandlers(): MockHandler[] {
  let loaded: MockHandler[] = [];
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/mocks/handlers") as { handlers: MockHandler[] };
    loaded = mod.handlers;
  });
  return loaded;
}

async function invoke(
  handlers: MockHandler[],
  method: MockHandler["method"],
  path: string,
  options: {
    params?: Record<string, string>;
    body?: unknown;
    malformedJson?: boolean;
  } = {},
) {
  const handler = handlers.find((h) => h.method === method && h.path === path);
  if (!handler) {
    throw new Error(`Handler not found for ${method} ${path}`);
  }
  return handler.resolver({
    params: options.params ?? {},
    request: {
      json: async () => {
        if (options.malformedJson) {
          throw new SyntaxError("Malformed JSON");
        }
        return options.body;
      },
    },
  });
}

const validCustomer: Customer = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  whatsapp: "+6281234567890",
  shippingAddress: "Jl. Sudirman Kav 21",
  city: "Medan",
  postalCode: "20111",
};

describe("MSW API Handlers (src/mocks/handlers.ts)", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    delete (globalThis as { dbCampaigns?: unknown }).dbCampaigns;
    delete (globalThis as { dbOrders?: unknown }).dbOrders;
  });

  it("unifies campaigns on globalThis.dbCampaigns, removes stale localStorage['dbCampaigns'], and aligns G15 seed fixtures", async () => {
    localStorage.setItem("dbCampaigns", JSON.stringify([{ id: "stale" }]));

    const handlers = loadHandlers();
    expect(localStorage.getItem("dbCampaigns")).toBeNull();

    // Advance clock past dropDate so drop is live, and suppress random chaos deductions
    const campaigns = getGlobalCampaigns();
    const dropTime = new Date(campaigns[0].dropDate).getTime();
    jest.spyOn(Date, "now").mockReturnValue(dropTime + 1000);
    jest.spyOn(Math, "random").mockReturnValue(0);

    // G15: expectedDelivery matches dropDate + productionTime * 86400000
    for (const c of campaigns) {
      const expected = new Date(
        new Date(c.dropDate).getTime() + c.productionTime * 86400000,
      ).toISOString();
      expect(c.expectedDelivery).toBe(expected);
    }

    // G15: debug_123 seed order alignment via GET /api/admin/orders
    const adminRes = await invoke(handlers, "GET", "/api/admin/orders");
    expect(adminRes.status).toBe(200);
    const seededOrders = adminRes.body as Order[];
    const debugOrder = seededOrders.find((o) => o.id === "debug_123");
    expect(debugOrder).toMatchObject({
      campaignId: "camp_kith_jkt_001",
      totalWeightKG: 1.25,
      subtotal: 2500000,
      shippingFee: 9000,
      totalAmount: 2509000,
      item: {
        name: "Kith for the New York Knicks",
        heroImage: "/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp",
      },
    });

    // Lock 1 unit -> GET /api/campaigns reflects decremented globalThis stock (G1)
    const lockRes = await invoke(handlers, "POST", "/api/checkout/lock", {
      body: {
        slug: "knicks-hoodie",
        variantId: "var_kith_blk_l",
        city: "Jakarta",
      },
    });
    expect(lockRes.status).toBe(200);

    const listRes = await invoke(handlers, "GET", "/api/campaigns");
    const listCampaigns = listRes.body as Campaign[];
    const variant = listCampaigns[0].variants.find(
      (v) => v.id === "var_kith_blk_l",
    );
    expect(variant?.availableInventory).toBe(11);
    expect(localStorage.getItem("dbCampaigns")).toBeNull();
  });

  it("reclaims variant stock once and persists EXPIRED in localStorage on timeout (G2, G3)", async () => {
    const handlers = loadHandlers();
    const campaigns = getGlobalCampaigns();
    const baseTime = new Date(campaigns[0].dropDate).getTime() + 1000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(baseTime);

    const lockRes = await invoke(handlers, "POST", "/api/checkout/lock", {
      body: {
        slug: "knicks-hoodie",
        variantId: "var_kith_blk_l",
        city: "Jakarta",
      },
    });
    expect(lockRes.status).toBe(200);
    const lockedOrder = lockRes.body as Order;

    const variantAfterLock = campaigns[0].variants.find(
      (v) => v.id === "var_kith_blk_l",
    );
    expect(variantAfterLock?.availableInventory).toBe(11);

    // Move past 15-minute expiry window
    nowSpy.mockReturnValue(baseTime + 16 * 60000);

    const expiredRes1 = await invoke(handlers, "GET", "/api/checkout/:sessionId", {
      params: { sessionId: lockedOrder.id },
    });
    expect(expiredRes1.status).toBe(410);
    expect(expiredRes1.body).toEqual({ error: "SESSION_EXPIRED" });

    // Stock reclaimed to 12 and EXPIRED persisted in localStorage
    expect(variantAfterLock?.availableInventory).toBe(12);
    const persisted = JSON.parse(
      localStorage.getItem("dbOrders") || "[]",
    ) as Order[];
    expect(persisted.find((o) => o.id === lockedOrder.id)?.status).toBe(
      "EXPIRED",
    );

    // Repeated poll / sweep does not double-increment stock beyond 12
    const expiredRes2 = await invoke(handlers, "GET", "/api/checkout/:sessionId", {
      params: { sessionId: lockedOrder.id },
    });
    expect(expiredRes2.status).toBe(410);
    await invoke(handlers, "GET", "/api/campaigns");
    expect(variantAfterLock?.availableInventory).toBe(12);
  });

  it("keeps paid orders accessible beyond 15m (G8) and returns 409 on duplicate complete (G10, G14)", async () => {
    const handlers = loadHandlers();
    const campaigns = getGlobalCampaigns();
    const baseTime = new Date(campaigns[0].dropDate).getTime() + 1000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(baseTime);

    const lockRes = await invoke(handlers, "POST", "/api/checkout/lock", {
      body: {
        slug: "knicks-hoodie",
        variantId: "var_kith_blk_l",
        city: "Jakarta",
      },
    });
    const order = lockRes.body as Order;

    // Invalid city rejected with 400 INVALID_SHIPPING_DETAILS (G14)
    const badCityRes = await invoke(handlers, "POST", "/api/checkout/complete", {
      body: {
        sessionId: order.id,
        shippingDetails: { ...validCustomer, city: "Atlantis" },
      },
    });
    expect(badCityRes.status).toBe(400);
    expect(badCityRes.body).toEqual({ error: "INVALID_SHIPPING_DETAILS" });

    // Valid completion recalculates shippingFee (Medan = 30000) & totalAmount
    const completeRes = await invoke(handlers, "POST", "/api/checkout/complete", {
      body: {
        sessionId: order.id,
        shippingDetails: validCustomer,
      },
    });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body).toEqual({
      success: true,
      receiptUrl: `/receipt/${order.id}`,
    });

    // Advance 2 hours past expiresAt: paid order remains accessible (G8)
    nowSpy.mockReturnValue(baseTime + 120 * 60000);
    const receiptRes = await invoke(handlers, "GET", "/api/checkout/:sessionId", {
      params: { sessionId: order.id },
    });
    expect(receiptRes.status).toBe(200);
    expect(receiptRes.body).toMatchObject({
      id: order.id,
      status: "PAYMENT_VERIFIED",
      shippingFee: 30000,
      totalAmount: 2530000,
      customer: validCustomer,
    });

    // Re-submitting POST /api/checkout/complete returns 409 ORDER_ALREADY_COMPLETED (G10)
    const dupRes = await invoke(handlers, "POST", "/api/checkout/complete", {
      body: {
        sessionId: order.id,
        shippingDetails: { ...validCustomer, fullName: "Attacker" },
      },
    });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body).toEqual({
      error: "ORDER_ALREADY_COMPLETED",
      receiptUrl: `/receipt/${order.id}`,
    });
  });

  it("enforces lock route guards, maxPurchase excluding debug_123, and admin status transitions (G12)", async () => {
    const handlers = loadHandlers();
    const campaigns = getGlobalCampaigns();
    const dropTime = new Date(campaigns[0].dropDate).getTime();

    // Before dropDate -> 403 DROP_NOT_ACTIVE
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(dropTime - 5000);
    const earlyRes = await invoke(handlers, "POST", "/api/checkout/lock", {
      body: {
        slug: "knicks-hoodie",
        variantId: "var_kith_blk_l",
        city: "Jakarta",
      },
    });
    expect(earlyRes.status).toBe(403);
    expect(earlyRes.body).toEqual({ error: "DROP_NOT_ACTIVE" });

    // Advance past dropDate
    nowSpy.mockReturnValue(dropTime + 1000);

    // Malformed / missing / unknown guards
    expect(
      (
        await invoke(handlers, "POST", "/api/checkout/lock", {
          malformedJson: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await invoke(handlers, "POST", "/api/checkout/lock", {
          body: { slug: "unknown", variantId: "var_kith_blk_l" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await invoke(handlers, "POST", "/api/checkout/lock", {
          body: { slug: "knicks-hoodie", variantId: "missing" },
        })
      ).status,
    ).toBe(404);

    // First active lock succeeds (debug_123 in IN_PRODUCTION does not block, nor would an AWAITING_PAYMENT debug_123)
    const firstLock = await invoke(handlers, "POST", "/api/checkout/lock", {
      body: {
        slug: "knicks-hoodie",
        variantId: "var_kith_blk_l",
        city: "Jakarta",
      },
    });
    expect(firstLock.status).toBe(200);
    const firstOrder = firstLock.body as Order;

    // Second concurrent lock on same campaign blocked by MAX_PURCHASE_EXCEEDED
    const secondLock = await invoke(handlers, "POST", "/api/checkout/lock", {
      body: {
        slug: "knicks-hoodie",
        variantId: "var_kith_blk_s",
        city: "Jakarta",
      },
    });
    expect(secondLock.status).toBe(409);
    expect(secondLock.body).toEqual({ error: "MAX_PURCHASE_EXCEEDED" });

    // Completing first order frees active hold so evaluator can place another order
    await invoke(handlers, "POST", "/api/checkout/complete", {
      body: { sessionId: firstOrder.id, shippingDetails: validCustomer },
    });

    const postCompleteLock = await invoke(
      handlers,
      "POST",
      "/api/checkout/lock",
      {
        body: {
          slug: "knicks-hoodie",
          variantId: "var_kith_blk_s",
          city: "Jakarta",
        },
      },
    );
    expect(postCompleteLock.status).toBe(200);

    // Admin PATCH validates ORDER_STATUS_FLOW sequentially
    const invalidJump = await invoke(
      handlers,
      "PATCH",
      "/api/admin/orders/:id",
      {
        params: { id: firstOrder.id },
        body: { status: "SHIPPED" },
      },
    );
    expect(invalidJump.status).toBe(409);
    expect(invalidJump.body).toEqual({ error: "INVALID_STATUS_TRANSITION" });

    const validStep = await invoke(
      handlers,
      "PATCH",
      "/api/admin/orders/:id",
      {
        params: { id: firstOrder.id },
        body: { status: "IN_PRODUCTION" },
      },
    );
    expect(validStep.status).toBe(200);
    expect(validStep.body).toMatchObject({
      success: true,
      order: { id: firstOrder.id, status: "IN_PRODUCTION" },
    });
  });

  it("ignores debug_123 even if status is AWAITING_PAYMENT and recovers corrupted dbOrders storage (G12, G13)", async () => {
    localStorage.setItem("dbOrders", "{corrupted-json");
    const handlers = loadHandlers();

    const adminRes = await invoke(handlers, "GET", "/api/admin/orders");
    const orders = adminRes.body as Order[];
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe("debug_123");

    // Force debug_123 to AWAITING_PAYMENT to verify explicit ID exclusion
    orders[0].status = "AWAITING_PAYMENT";
    orders[0].expiresAt = new Date(Date.now() + 60 * 60000).toISOString();
    localStorage.setItem("dbOrders", JSON.stringify(orders));

    const campaigns = getGlobalCampaigns();
    const dropTime = new Date(campaigns[0].dropDate).getTime();
    jest.spyOn(Date, "now").mockReturnValue(dropTime + 1000);

    const lockRes = await invoke(handlers, "POST", "/api/checkout/lock", {
      body: {
        slug: "knicks-hoodie",
        variantId: "var_kith_blk_l",
        city: "Jakarta",
      },
    });
    expect(lockRes.status).toBe(200);
  });
});
