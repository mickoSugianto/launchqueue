import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes } from "react";
import ReceiptPage from "@/app/receipt/[sessionId]/page";
import { useCheckout } from "@/lib/hooks/useCheckout";
import type { Order, OrderStatus } from "@/types";

jest.mock("@/lib/hooks/useCheckout");

const mockPush = jest.fn();
const stableRouter = { push: mockPush };

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => stableRouter,
  useParams: () => ({ sessionId: "ord_receipt_123" }),
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

function createReceiptOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord_receipt_123",
    campaignId: "camp_kith_jkt_001",
    variantId: "var_kith_blk_l",
    status: "PAYMENT_VERIFIED",
    totalPcs: 1,
    totalWeightKG: 1.25,
    subtotal: 2500000,
    shippingFee: 9000,
    totalAmount: 2509000,
    lockedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:15:00.000Z",
    customer: {
      fullName: "Johnathan Doe",
      email: "john@example.com",
      whatsapp: "081234567890",
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
    ...overrides,
  };
}

describe("ReceiptPage - Gatekeeper, Details & Fulfillment Timeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders 'Retrieving Order...' while loading", () => {
    (useCheckout as jest.Mock).mockReturnValue({
      order: undefined,
      isLoading: true,
      isError: false,
    });

    render(<ReceiptPage />);

    expect(screen.getByText(/Retrieving Order.../i)).toBeInTheDocument();
  });

  it("renders 'Retrieving Order...' during initial mount revalidation of stale pre-payment cache and stays stable on subsequent polls", () => {
    (useCheckout as jest.Mock).mockReturnValue({
      order: createReceiptOrder({ status: "AWAITING_PAYMENT" }),
      isLoading: false,
      isValidating: true,
      isError: false,
    });

    const { rerender } = render(<ReceiptPage />);

    expect(screen.getByText(/Retrieving Order.../i)).toBeInTheDocument();
    expect(
      screen.queryByText("Order Not Found or Payment Incomplete"),
    ).not.toBeInTheDocument();

    // Once initial revalidation settles with AWAITING_PAYMENT, show the gatekeeper error
    (useCheckout as jest.Mock).mockReturnValue({
      order: createReceiptOrder({ status: "AWAITING_PAYMENT" }),
      isLoading: false,
      isValidating: false,
      isError: false,
    });
    rerender(<ReceiptPage />);

    expect(
      screen.getByText("Order Not Found or Payment Incomplete"),
    ).toBeInTheDocument();

    // Subsequent 3s background poll must not flicker back to "Retrieving Order..."
    (useCheckout as jest.Mock).mockReturnValue({
      order: createReceiptOrder({ status: "AWAITING_PAYMENT" }),
      isLoading: false,
      isValidating: true,
      isError: false,
    });
    rerender(<ReceiptPage />);

    expect(
      screen.getByText("Order Not Found or Payment Incomplete"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Retrieving Order.../i)).not.toBeInTheDocument();
  });

  it.each<OrderStatus>(["AWAITING_PAYMENT", "EXPIRED", "CANCELLED"])(
    "blocks access for invalid %s status and allows returning to store",
    async (status) => {
      const user = userEvent.setup();

      (useCheckout as jest.Mock).mockReturnValue({
        order: createReceiptOrder({ status }),
        isLoading: false,
        isError: false,
      });

      render(<ReceiptPage />);

      expect(
        screen.getByText("Order Not Found or Payment Incomplete"),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: /Return to Store/i }),
      );
      expect(mockPush).toHaveBeenCalledWith("/");
    },
  );

  it("blocks access when useCheckout returns an error", () => {
    (useCheckout as jest.Mock).mockReturnValue({
      order: undefined,
      isLoading: false,
      isError: true,
    });

    render(<ReceiptPage />);

    expect(
      screen.getByText("Order Not Found or Payment Incomplete"),
    ).toBeInTheDocument();
  });

  it("renders customer, shipping, and persisted OrderSummary details", () => {
    (useCheckout as jest.Mock).mockReturnValue({
      order: createReceiptOrder(),
      isLoading: false,
      isError: false,
    });

    render(<ReceiptPage />);

    expect(screen.getByText("Order Confirmed")).toBeInTheDocument();
    expect(
      screen.getByText(/Thank you, Johnathan\. Your order has been received/i),
    ).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("081234567890")).toBeInTheDocument();
    expect(screen.getByText("Johnathan Doe")).toBeInTheDocument();
    expect(screen.getByText("Jl. Sudirman Kav 21")).toBeInTheDocument();
    expect(screen.getByText("Jakarta, 12190")).toBeInTheDocument();
    expect(screen.getByText("Kith for the New York Knicks")).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*2\.509\.000/)).toBeInTheDocument();
  });

  it.each<{
    status: OrderStatus;
    activeLabels: string[];
    inactiveLabels: string[];
    expectedWidthClass: string;
  }>([
    {
      status: "PAYMENT_VERIFIED",
      activeLabels: ["Paid"],
      inactiveLabels: ["In Production", "Ready to Ship", "Shipped"],
      expectedWidthClass: "w-0",
    },
    {
      status: "IN_PRODUCTION",
      activeLabels: ["Paid", "In Production"],
      inactiveLabels: ["Ready to Ship", "Shipped"],
      expectedWidthClass: "w-1/3",
    },
    {
      status: "READY_TO_SHIP",
      activeLabels: ["Paid", "In Production", "Ready to Ship"],
      inactiveLabels: ["Shipped"],
      expectedWidthClass: "w-2/3",
    },
    {
      status: "SHIPPED",
      activeLabels: ["Paid", "In Production", "Ready to Ship", "Shipped"],
      inactiveLabels: [],
      expectedWidthClass: "w-full",
    },
  ])(
    "animates timeline progression accurately for %s",
    ({ status, activeLabels, inactiveLabels, expectedWidthClass }) => {
      jest.useFakeTimers();

      (useCheckout as jest.Mock).mockReturnValue({
        order: createReceiptOrder({ status }),
        isLoading: false,
        isError: false,
      });

      const { container } = render(<ReceiptPage />);

      // Before 800ms mount delay, all labels stay inactive
      expect(screen.getByText("Paid")).toHaveClass("text-zinc-400");

      act(() => {
        jest.advanceTimersByTime(800);
      });

      for (const label of activeLabels) {
        expect(screen.getByText(label)).toHaveClass("text-zinc-900");
      }
      for (const label of inactiveLabels) {
        expect(screen.getByText(label)).toHaveClass("text-zinc-400");
      }

      const progressBar = container.querySelector(".bg-zinc-900.-z-10");
      expect(progressBar).toHaveClass(expectedWidthClass);
    },
  );
});
