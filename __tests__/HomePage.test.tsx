import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "@/app/page";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useActiveCheckout } from "@/lib/hooks/useActiveCheckout";
import { toast } from "sonner";

jest.mock("@/lib/hooks/useCampaigns");
jest.mock("@/lib/hooks/useActiveCheckout");
jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe("HomePage", () => {
  const mockMutateCampaigns = jest.fn();
  const mockMutateActive = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useActiveCheckout as jest.Mock).mockReturnValue({
      activeOrder: null,
      activeOrders: [],
      isLoading: false,
      isError: false,
      mutate: mockMutateActive,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // TEST A: DOES THE GATEKEEPER WORK?
  it("renders the loading state initially", () => {
    (useCampaigns as jest.Mock).mockReturnValue({
      campaigns: [],
      isLoading: true,
      isError: false,
      mutate: mockMutateCampaigns,
    });

    render(<HomePage />);

    expect(screen.getByText(/Initializing Engine.../i)).toBeInTheDocument();
  });

  // TEST B: DOES THE UI RENDER DATA CORRECTLY?
  it("renders the campaigns when data successfully loads", () => {
    (useCampaigns as jest.Mock).mockReturnValue({
      campaigns: [
        {
          id: "camp_mock_123",
          brandId: "mock",
          title: "Mock Hoodie",
          slug: "mock-hoodie",
          isActive: true,
          heroImages: ["/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp"],
        },
      ],
      isLoading: false,
      isError: false,
      mutate: mockMutateCampaigns,
    });

    render(<HomePage />);

    expect(screen.getByText("LaunchQueue")).toBeInTheDocument();
    expect(screen.getByText("Mock Hoodie")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText(/Active Checkout Hold/i)).not.toBeInTheDocument();
  });

  it("renders Retry button on error and invokes mutate()", async () => {
    const user = userEvent.setup();
    const mockMutate = jest.fn();

    (useCampaigns as jest.Mock).mockReturnValue({
      campaigns: [],
      isLoading: false,
      isError: true,
      mutate: mockMutate,
    });

    render(<HomePage />);

    expect(screen.getByText(/System Failure\./i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("renders ActiveCheckoutBanner, supports Resume Checkout & Release Hold (success and failure), and revalidates at 00:00", async () => {
    const user = userEvent.setup();

    (useCampaigns as jest.Mock).mockReturnValue({
      campaigns: [],
      isLoading: false,
      isError: false,
      mutate: mockMutateCampaigns,
    });

    (useActiveCheckout as jest.Mock).mockReturnValue({
      activeOrder: {
        id: "ord_hold_1",
        campaignId: "camp_mock_123",
        variantId: "var_1",
        status: "AWAITING_PAYMENT",
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
        leftAt: new Date(Date.now()).toISOString(),
        item: {
          name: "Mock Hoodie",
          color: "Black",
          size: "L",
          heroImage: "",
        },
      },
      activeOrders: [],
      isLoading: false,
      isError: false,
      mutate: mockMutateActive,
    });

    // 1. Failure keeps banner visible & shows toast.error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { unmount } = render(<HomePage />);

    expect(screen.getByText(/Active Checkout Hold/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Resume Checkout/i }),
    ).toHaveAttribute("href", "/checkout/ord_hold_1");

    await user.click(screen.getByRole("button", { name: /Release Hold/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Unable to cancel reservation. Please try again.",
      );
    });
    expect(screen.getByText(/Active Checkout Hold/i)).toBeInTheDocument();

    // 2. Success releases hold and revalidates
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, status: "CANCELLED" }),
    });

    await user.click(screen.getByRole("button", { name: /Release Hold/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/checkout/ord_hold_1/cancel",
        expect.objectContaining({ method: "POST" }),
      );
      expect(toast.info).toHaveBeenCalledWith(
        "Checkout cancelled. Your reserved item has been released.",
      );
      expect(mockMutateActive).toHaveBeenCalled();
      expect(mockMutateCampaigns).toHaveBeenCalled();
    });
    unmount();

    // 3. Countdown hitting 00:00 triggers revalidation once
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    (useActiveCheckout as jest.Mock).mockReturnValue({
      activeOrder: {
        id: "ord_hold_2",
        campaignId: "camp_mock_123",
        variantId: "var_1",
        status: "AWAITING_PAYMENT",
        expiresAt: "2026-01-01T00:15:00.000Z",
        leftAt: "2025-12-31T23:57:02.000Z", // 2 seconds left in 3-min grace window
        item: {
          name: "Mock Hoodie",
          color: "Black",
          size: "L",
          heroImage: "",
        },
      },
      activeOrders: [],
      isLoading: false,
      isError: false,
      mutate: mockMutateActive,
    });

    render(<HomePage />);
    expect(screen.getByText("00:02")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(mockMutateActive).toHaveBeenCalledTimes(1);
    expect(mockMutateCampaigns).toHaveBeenCalledTimes(1);
  });
});
