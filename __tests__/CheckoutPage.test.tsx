import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes } from "react";
import CheckoutPage from "@/app/checkout/[sessionId]/page";
import { CheckoutTimer } from "@/components/checkout/CheckoutTimer";
import { useCheckout } from "@/lib/hooks/useCheckout";
import { toast } from "sonner";
import type { Order } from "@/types";

jest.mock("@/lib/hooks/useCheckout");

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const stableRouter = { push: mockPush, replace: mockReplace };

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => stableRouter,
  useParams: () => ({ sessionId: "ord_test_123" }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    void _fill;
    void _priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

global.fetch = jest.fn();

const mockShippingRates = {
  Jakarta: 9000,
  Bandung: 11000,
  Surabaya: 19000,
  Bali: 25000,
  Medan: 30000,
};

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord_test_123",
    campaignId: "camp_kith_jkt_001",
    variantId: "var_kith_blk_l",
    status: "AWAITING_PAYMENT",
    totalPcs: 1,
    totalWeightKG: 1.25,
    subtotal: 2500000,
    shippingFee: 9000,
    totalAmount: 2509000,
    lockedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
    customer: {
      fullName: "",
      email: "",
      whatsapp: "",
      shippingAddress: "",
      city: "Jakarta",
      postalCode: "",
    },
    item: {
      name: "Kith for the New York Knicks",
      color: "Black",
      size: "L",
      heroImage: "/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp",
    },
    ...overrides,
  };
}

describe("CheckoutPage, AddressForm, OrderSummary & CheckoutTimer", () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/shipping-rates") {
        return Promise.resolve({
          ok: true,
          json: async () => mockShippingRates,
        });
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders 'Securing Session...' while loading", async () => {
    (useCheckout as jest.Mock).mockReturnValue({
      order: undefined,
      isLoading: true,
      isError: false,
      mutate: mockMutate,
    });

    render(<CheckoutPage />);

    expect(screen.getByText(/Securing Session.../i)).toBeInTheDocument();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/shipping-rates");
    });
  });

  it("renders 'Session Expired or Invalid' on error or EXPIRED status and returns to lobby", async () => {
    const user = userEvent.setup();

    (useCheckout as jest.Mock).mockReturnValue({
      order: createOrder({ status: "EXPIRED" }),
      isLoading: false,
      isError: false,
      mutate: mockMutate,
    });

    render(<CheckoutPage />);

    expect(screen.getByText(/Session Expired or Invalid/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Return to Lobby/i }));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("redirects paid orders to /receipt/[id] instead of rendering checkout form", async () => {
    (useCheckout as jest.Mock).mockReturnValue({
      order: createOrder({ status: "PAYMENT_VERIFIED" }),
      isLoading: false,
      isError: false,
      mutate: mockMutate,
    });

    render(<CheckoutPage />);

    expect(screen.getByText(/Redirecting to Receipt.../i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Complete Purchase/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/receipt/ord_test_123");
    });
  });

  it("validates AddressForm fields, recalculates OrderSummary shipping dynamically, and submits checkout", async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/shipping-rates") {
        return Promise.resolve({
          ok: true,
          json: async () => mockShippingRates,
        });
      }
      if (url === "/api/checkout/complete") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            receiptUrl: "/receipt/ord_test_123",
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    });

    (useCheckout as jest.Mock).mockReturnValue({
      order: createOrder(),
      isLoading: false,
      isError: false,
      mutate: mockMutate,
    });

    render(<CheckoutPage />);

    // Wait for dynamic cities from /api/shipping-rates to hydrate
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Medan" })).toBeInTheDocument();
    });

    // Initial summary reflects Jakarta (Rp 9.000) and Rp 2.509.000 total
    expect(screen.getByText(/Rp\s*9\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*2\.509\.000/)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: /Complete Purchase/i,
    });
    expect(submitBtn).toBeDisabled();

    // Test invalid WhatsApp & Postal Code validation on blur
    const whatsappInput = screen.getByLabelText(/Whatsapp Number/i);
    await user.type(whatsappInput, "not-a-phone");
    await user.tab();
    expect(
      await screen.findByText(/Enter a valid 10-15 digit phone number/i),
    ).toBeInTheDocument();

    const postalInput = screen.getByLabelText(/Postal Code/i);
    await user.type(postalInput, "1234a");
    await user.tab();
    expect(
      await screen.findByText(/Postal code must be 5 digits/i),
    ).toBeInTheDocument();

    // Fill all fields with valid trimmed/formatted values
    await user.type(screen.getByLabelText(/Full Name/i), "  Jane Doe  ");
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "jane@example.com",
    );
    await user.clear(whatsappInput);
    await user.type(whatsappInput, "+6281234567890");
    await user.type(
      screen.getByLabelText(/Street Address/i),
      "Jl. Jend. Sudirman Kav 21",
    );
    await user.selectOptions(screen.getByLabelText(/City/i), "Medan");
    await user.clear(postalInput);
    await user.type(postalInput, "20111");

    // Dynamic shipping preview recalculates immediately to Medan (Rp 30.000)
    await waitFor(() => {
      expect(screen.getByText(/Rp\s*30\.000/)).toBeInTheDocument();
      expect(screen.getByText(/Rp\s*2\.530\.000/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(submitBtn).toBeEnabled();
    });

    await user.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/checkout/complete",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "ord_test_123",
            shippingDetails: {
              fullName: "Jane Doe",
              email: "jane@example.com",
              whatsapp: "+6281234567890",
              shippingAddress: "Jl. Jend. Sudirman Kav 21",
              city: "Medan",
              postalCode: "20111",
            },
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/receipt/ord_test_123");
    });
  });

  it("handles 409 ORDER_ALREADY_COMPLETED by showing toast.error and redirecting to receipt", async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/shipping-rates") {
        return Promise.resolve({
          ok: true,
          json: async () => mockShippingRates,
        });
      }
      if (url === "/api/checkout/complete") {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: "ORDER_ALREADY_COMPLETED",
            receiptUrl: "/receipt/ord_test_123",
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    });

    (useCheckout as jest.Mock).mockReturnValue({
      order: createOrder(),
      isLoading: false,
      isError: false,
      mutate: mockMutate,
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Jakarta" }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), "Jane Doe");
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "jane@example.com",
    );
    await user.type(screen.getByLabelText(/Whatsapp Number/i), "081234567890");
    await user.type(
      screen.getByLabelText(/Street Address/i),
      "Jl. Jend. Sudirman Kav 21",
    );
    await user.selectOptions(screen.getByLabelText(/City/i), "Jakarta");
    await user.type(screen.getByLabelText(/Postal Code/i), "12190");

    const submitBtn = screen.getByRole("button", {
      name: /Complete Purchase/i,
    });
    await waitFor(() => expect(submitBtn).toBeEnabled());
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Order already completed. Redirecting to receipt...",
      );
      expect(mockReplace).toHaveBeenCalledWith("/receipt/ord_test_123");
    });
  });

  it("handles 410 SESSION_EXPIRED on submit via toast.error, immediate expiry UI, and mutate()", async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === "/api/shipping-rates") {
        return Promise.resolve({
          ok: true,
          json: async () => mockShippingRates,
        });
      }
      if (url === "/api/checkout/complete") {
        return Promise.resolve({
          ok: false,
          status: 410,
          json: async () => ({ error: "SESSION_EXPIRED" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    });

    (useCheckout as jest.Mock).mockReturnValue({
      order: createOrder(),
      isLoading: false,
      isError: false,
      mutate: mockMutate,
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "Jakarta" }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), "Jane Doe");
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "jane@example.com",
    );
    await user.type(screen.getByLabelText(/Whatsapp Number/i), "081234567890");
    await user.type(
      screen.getByLabelText(/Street Address/i),
      "Jl. Jend. Sudirman Kav 21",
    );
    await user.selectOptions(screen.getByLabelText(/City/i), "Jakarta");
    await user.type(screen.getByLabelText(/Postal Code/i), "12190");

    const submitBtn = screen.getByRole("button", {
      name: /Complete Purchase/i,
    });
    await waitFor(() => expect(submitBtn).toBeEnabled());
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("SESSION_EXPIRED");
      expect(
        screen.getByText(/Session Expired or Invalid/i),
      ).toBeInTheDocument();
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it("renders accurate initial time without '15:00' flash and cleans up interval on unmount", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const onExpire = jest.fn();

    const { unmount } = render(
      <CheckoutTimer
        expiresAt="2026-01-01T00:05:00.000Z"
        onExpire={onExpire}
      />,
    );

    expect(screen.getByText("05:00")).toBeInTheDocument();
    expect(screen.queryByText("15:00")).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("04:59")).toBeInTheDocument();

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(5 * 60000);
    });
    expect(onExpire).not.toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it("immediately marks CheckoutPage expired and invokes mutate() when CheckoutTimer hits 00:00", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    (useCheckout as jest.Mock).mockReturnValue({
      order: createOrder({
        expiresAt: "2026-01-01T00:00:02.000Z",
      }),
      isLoading: false,
      isError: false,
      mutate: mockMutate,
    });

    await act(async () => {
      render(<CheckoutPage />);
    });

    expect(screen.getByText("00:02")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Complete Purchase/i }),
    ).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/Session Expired or Invalid/i)).toBeInTheDocument();
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });
});
