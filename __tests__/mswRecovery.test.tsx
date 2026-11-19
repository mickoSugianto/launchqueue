import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { apiFetch, ensureMswActive } from "@/lib/apiFetch";
import { MSWProvider } from "@/components/providers/MSWProvider";
import { useCheckout } from "@/lib/hooks/useCheckout";

const mockWorkerStart = jest.fn().mockResolvedValue(undefined);
const mockWorkerStop = jest.fn();

jest.mock("@/mocks/browser", () => ({
  worker: {
    start: (...args: unknown[]) => mockWorkerStart(...args),
    stop: (...args: unknown[]) => mockWorkerStop(...args),
  },
}));

const mockMutate = jest.fn();
jest.mock("swr", () => {
  const actual = jest.requireActual("swr");
  return {
    __esModule: true,
    ...actual,
    mutate: (...args: unknown[]) => mockMutate(...args),
  };
});

function CheckoutHookProbe({ sessionId }: { sessionId: string }) {
  const { order, isLoading, isError, isSessionInvalid } =
    useCheckout(sessionId);

  if (isLoading) return <div>loading</div>;
  if (isError) {
    return (
      <div>
        <span data-testid="error-message">{isError.message}</span>
        <span data-testid="session-invalid">
          {String(isSessionInvalid)}
        </span>
      </div>
    );
  }
  return <div data-testid="order-id">{order?.id}</div>;
}

describe("MSW Wake Recovery, apiFetch & useCheckout Error Distinction", () => {
  const originalFetch = global.fetch;
  const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "serviceWorker",
  );

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalServiceWorkerDescriptor) {
      Object.defineProperty(
        navigator,
        "serviceWorker",
        originalServiceWorkerDescriptor,
      );
    } else {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
  });

  it("apiFetch preserves fetch(url) signature and no-ops when serviceWorker is absent", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
    });

    const res = await apiFetch("/api/campaigns");

    expect(res.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/campaigns");
    await expect(ensureMswActive()).resolves.toBe(false);
  });

  it("apiFetch reactivates via MOCK_ACTIVATE -> MOCKING_ENABLED and retries bypassed /api/* 404 HTML once", async () => {
    const listeners = new Map<string, Set<EventListener>>();
    const mockController = {
      state: "activated",
      postMessage: jest.fn((msg: unknown) => {
        if (msg === "MOCK_ACTIVATE") {
          const event = new MessageEvent("message", {
            data: { type: "MOCKING_ENABLED" },
          });
          listeners.get("message")?.forEach((cb) => cb(event));
        }
      }),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: mockController,
        getRegistration: jest.fn().mockResolvedValue({ active: mockController }),
        addEventListener: (type: string, cb: EventListener) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(cb);
        },
        removeEventListener: (type: string, cb: EventListener) => {
          listeners.get(type)?.delete(cb);
        },
      },
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [{ id: "camp_1" }],
      });

    const res = await apiFetch("/api/campaigns");

    expect(mockController.postMessage).toHaveBeenCalledWith("MOCK_ACTIVATE");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it("apiFetch does NOT treat genuine MSW JSON 404 responses as bypassed", async () => {
    const mockController = {
      state: "activated",
      postMessage: jest.fn(),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: mockController,
        getRegistration: jest.fn().mockResolvedValue({ active: mockController }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "SESSION_NOT_FOUND" }),
    });

    const res = await apiFetch("/api/checkout/missing");

    expect(res.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockController.postMessage).not.toHaveBeenCalled();
  });

  it("apiFetch restarts worker cleanly when controller/registration was lost", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: null,
        getRegistration: jest.fn().mockResolvedValue(undefined),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "text/html" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
      });

    const res = await apiFetch("/api/admin/orders", { method: "GET" });

    expect(mockWorkerStop).toHaveBeenCalledTimes(1);
    expect(mockWorkerStart).toHaveBeenCalledWith({
      onUnhandledRequest: "bypass",
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it("MSWProvider reactivates MSW and revalidates /api/* queries on wake events", async () => {
    const listeners = new Map<string, Set<EventListener>>();
    const mockController = {
      state: "activated",
      postMessage: jest.fn((msg: unknown) => {
        if (msg === "MOCK_ACTIVATE") {
          const event = new MessageEvent("message", {
            data: { type: "MOCKING_ENABLED" },
          });
          listeners.get("message")?.forEach((cb) => cb(event));
        }
      }),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: mockController,
        getRegistration: jest.fn().mockResolvedValue({ active: mockController }),
        addEventListener: (type: string, cb: EventListener) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(cb);
        },
        removeEventListener: (type: string, cb: EventListener) => {
          listeners.get(type)?.delete(cb);
        },
      },
    });

    render(
      <MSWProvider>
        <div>App Ready</div>
      </MSWProvider>,
    );

    expect(await screen.findByText("App Ready")).toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mockController.postMessage).toHaveBeenCalledWith("MOCK_ACTIVATE");
      expect(mockMutate).toHaveBeenCalled();
    });

    const filterFn = mockMutate.mock.calls[0][0] as (key: unknown) => boolean;
    expect(filterFn("/api/campaigns")).toBe(true);
    expect(filterFn("/other")).toBe(false);
  });

  it("useCheckout handles non-JSON 404 HTML without SyntaxError and distinguishes it from SESSION_EXPIRED / SESSION_NOT_FOUND", async () => {
    // 1. HTML 404 -> transient/engine error (isSessionInvalid === false)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    });

    const { unmount } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CheckoutHookProbe sessionId="ord_html_404" />
      </SWRConfig>,
    );

    expect(await screen.findByTestId("error-message")).toHaveTextContent(
      "Failed to fetch session",
    );
    expect(screen.getByTestId("session-invalid")).toHaveTextContent("false");
    unmount();

    // 2. 410 SESSION_EXPIRED -> genuine session invalid (isSessionInvalid === true)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 410,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "SESSION_EXPIRED" }),
    });

    const { unmount: unmount2 } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CheckoutHookProbe sessionId="ord_expired" />
      </SWRConfig>,
    );

    expect(await screen.findByTestId("error-message")).toHaveTextContent(
      "SESSION_EXPIRED",
    );
    expect(screen.getByTestId("session-invalid")).toHaveTextContent("true");
    unmount2();

    // 3. 404 SESSION_NOT_FOUND -> genuine session invalid (isSessionInvalid === true)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "SESSION_NOT_FOUND" }),
    });

    const { unmount: unmount3 } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CheckoutHookProbe sessionId="ord_missing" />
      </SWRConfig>,
    );

    expect(await screen.findByTestId("error-message")).toHaveTextContent(
      "SESSION_NOT_FOUND",
    );
    expect(screen.getByTestId("session-invalid")).toHaveTextContent("true");
    unmount3();

    // 4. 410 SESSION_CANCELLED -> genuine session invalid (isSessionInvalid === true)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 410,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "SESSION_CANCELLED" }),
    });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CheckoutHookProbe sessionId="ord_cancelled" />
      </SWRConfig>,
    );

    expect(await screen.findByTestId("error-message")).toHaveTextContent(
      "SESSION_CANCELLED",
    );
    expect(screen.getByTestId("session-invalid")).toHaveTextContent("true");
  });
});
