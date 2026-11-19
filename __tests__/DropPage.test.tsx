import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DropPage from "@/app/(buyer)/[brand]/[slug]/page";
import { useCampaign } from "@/lib/hooks/useCampaign";
import { useActiveCheckout } from "@/lib/hooks/useActiveCheckout";
import { toast } from "sonner";
import type { ImgHTMLAttributes } from "react";
import { useEffect } from "react";

// MOCKS
// MOCK THE DATA HOOKS
jest.mock("@/lib/hooks/useCampaign");
jest.mock("@/lib/hooks/useActiveCheckout");

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockPush = jest.fn();
const mockUseParams = jest.fn(() => ({
  brand: "kith",
  slug: "premium-heavy-knitwear",
}));

// mock the router
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush }),
  useParams: () => mockUseParams(),
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

// MOCK DROPCOUNTDOWN TO TRIGGER ISLIVE
jest.mock("@/components/drop/DropCountdown", () => ({
  DropCountdown: ({ onLive }: { onLive: () => void }) => {
    useEffect(() => {
      onLive();
    }, [onLive]);

    return <div>00:00:00</div>;
  },
}));

// MOCK THE GLOBAL FETCH
global.fetch = jest.fn();

describe("DropPage - Checkout Logic & Race Conditions", () => {
  const mockMutateActive = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({
      brand: "kith",
      slug: "premium-heavy-knitwear",
    });
    (useActiveCheckout as jest.Mock).mockReturnValue({
      activeOrder: null,
      activeOrders: [],
      isLoading: false,
      isError: false,
      mutate: mockMutateActive,
    });
  });

  const mockCampaignBase = {
    id: "camp_knit_123",
    title: "Premium Heavy Knitwear Drop",
    brandId: "kith",
    productionTime: 14,
    dropDate: "2025-06-16T00:00:00Z",
    heroImages: ["/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp"],
    sizeChart: "/images/KITH_NEW_YORK_KNICKS_SIZE_GUIDE.jpeg",
    isActive: true,
  };

  it("allows queue entry when variant is selected and inventory is available", async () => {
    const user = userEvent.setup();

    // mock succesful API response
    let resolveFetch: (value: unknown) => void;
    const deferredFetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce(deferredFetchPromise);

    //mock hook with inventory
    (useCampaign as jest.Mock).mockReturnValue({
      campaign: {
        ...mockCampaignBase,
        variants: [
          {
            id: "var_kith_blk_l",
            name: "Kith for the New York Knicks",
            color: "Black",
            size: "L",
            price: 2500000,
            totalInventory: 12,
            availableInventory: 12,
            weightKG: 1.2, // Heavyweight hoodies are heavy!
            maxPurchase: 1, // Strict anti-scalper limit
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<DropPage />);

    // wait for the DropCountdown to show "Drop is Live"
    await waitFor(() => {
      expect(screen.getByText(/Drop is Live/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/15-min checkout hold/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /kith/i })).toHaveAttribute(
      "href",
      "/",
    );

    // Verify initial button state
    const actionButton = screen.getByRole("button", { name: /Select a Size/i });
    expect(actionButton).toBeDisabled();

    // select the variant from the radiogroup
    const variantLabel = screen.getByText("L");
    await user.click(variantLabel);

    // the button should now be enabled and read "Buy Now"
    const buyNowBtn = screen.getByRole("button", { name: /Buy Now/i });
    expect(buyNowBtn).toBeEnabled();

    // click it to trigger the lock
    await user.click(buyNowBtn);

    // UI should immediately switch to optimistic locking state
    const lockingButton = await screen.findByRole("button", {
      name: /Locking Inventory/i,
    });
    expect(lockingButton).toBeDisabled();

    // verify the correct API payload was sent
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/checkout/lock",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          slug: "premium-heavy-knitwear",
          variantId: "var_kith_blk_l",
          city: "Jakarta",
        }),
      }),
    );

    // CLEAN UP: UNFREEZE THE NETWORK REQUEST
    resolveFetch!({
      ok: true,
      json: async () => ({ id: "checkout_session_123" }),
    });

    // await the dom to clear the locking text to prevent act() warning
    await waitFor(() => {
      expect(screen.queryByText(/Locking Inventory/i)).not.toBeInTheDocument();
    });
  });

  it("hard-locks and disables selection instantly if stock is zero", async () => {
    //mock hook with zero inventory
    (useCampaign as jest.Mock).mockReturnValue({
      campaign: {
        ...mockCampaignBase,
        variants: [
          {
            id: "var_kith_blk_l",
            name: "Kith for the New York Knicks",
            color: "Black",
            size: "L",
            price: 2500000,
            totalInventory: 0,
            availableInventory: 0,
            weightKG: 1.2, // Heavyweight hoodies are heavy!
            maxPurchase: 1, // Strict anti-scalper limit
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<DropPage />);

    await waitFor(() => {
      expect(screen.getByText(/Drop is Live/i)).toBeInTheDocument();
    });

    // validate sold out
    expect(screen.getByText("Sold Out")).toBeInTheDocument();

    // the master action button remains dead
    const actionButton = screen.getByRole("button", { name: /Select a Size/i });
    expect(actionButton).toBeDisabled();
  });

  it("renders 404 when the URL brand segment mismatches campaign.brandId", () => {
    mockUseParams.mockReturnValue({
      brand: "fear-of-god",
      slug: "premium-heavy-knitwear",
    });

    (useCampaign as jest.Mock).mockReturnValue({
      campaign: {
        ...mockCampaignBase,
        variants: [
          {
            id: "var_kith_blk_l",
            name: "Kith for the New York Knicks",
            color: "Black",
            size: "L",
            price: 2500000,
            totalInventory: 12,
            availableInventory: 12,
            weightKG: 1.2,
            maxPurchase: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<DropPage />);

    expect(screen.getByText("404 - Drop Not Found")).toBeInTheDocument();
  });

  it("surfaces MAX_PURCHASE_EXCEEDED error toast instead of Sold Out on 409 lock rejection", async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "MAX_PURCHASE_EXCEEDED" }),
    });

    (useCampaign as jest.Mock).mockReturnValue({
      campaign: {
        ...mockCampaignBase,
        variants: [
          {
            id: "var_kith_blk_l",
            name: "Kith for the New York Knicks",
            color: "Black",
            size: "L",
            price: 2500000,
            totalInventory: 12,
            availableInventory: 12,
            weightKG: 1.2,
            maxPurchase: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<DropPage />);

    await waitFor(() => {
      expect(screen.getByText(/Drop is Live/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("L"));
    await user.click(screen.getByRole("button", { name: /Buy Now/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Purchase limit reached. Please complete or wait for your active checkout session to expire.",
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("opens Size Guide modal without Radix DialogDescription warnings", async () => {
    const user = userEvent.setup();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    (useCampaign as jest.Mock).mockReturnValue({
      campaign: {
        ...mockCampaignBase,
        variants: [
          {
            id: "var_kith_blk_l",
            name: "Kith for the New York Knicks",
            color: "Black",
            size: "L",
            price: 2500000,
            totalInventory: 12,
            availableInventory: 12,
            weightKG: 1.2,
            maxPurchase: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    try {
      render(<DropPage />);

      await user.click(screen.getByRole("button", { name: /Size Guide/i }));

      expect(
        await screen.findByRole("heading", { name: /Size Guide/i }),
      ).toBeInTheDocument();
      expect(screen.getByAltText("Brand Size Guide")).toBeInTheDocument();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("displays ActiveCheckoutBanner on DropPage and releases hold", async () => {
    const user = userEvent.setup();
    const mockMutateCampaign = jest.fn();

    (useCampaign as jest.Mock).mockReturnValue({
      campaign: {
        ...mockCampaignBase,
        variants: [
          {
            id: "var_kith_blk_l",
            name: "Kith for the New York Knicks",
            color: "Black",
            size: "L",
            price: 2500000,
            totalInventory: 12,
            availableInventory: 11,
            weightKG: 1.2,
            maxPurchase: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
      mutate: mockMutateCampaign,
    });

    (useActiveCheckout as jest.Mock).mockReturnValue({
      activeOrder: {
        id: "ord_drop_hold",
        campaignId: "camp_knit_123",
        variantId: "var_kith_blk_l",
        status: "AWAITING_PAYMENT",
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
        leftAt: null,
        item: {
          name: "Premium Heavy Knitwear Drop",
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

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, status: "CANCELLED" }),
    });

    render(<DropPage />);

    expect(useActiveCheckout).toHaveBeenCalledWith("camp_knit_123");
    expect(screen.getByText(/^Active Checkout Hold$/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Resume Checkout/i }),
    ).toHaveAttribute("href", "/checkout/ord_drop_hold");

    await user.click(screen.getByRole("button", { name: /Release Hold/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/checkout/ord_drop_hold/cancel",
        expect.objectContaining({ method: "POST" }),
      );
      expect(toast.info).toHaveBeenCalledWith(
        "Checkout cancelled. Your reserved item has been released.",
      );
      expect(mockMutateActive).toHaveBeenCalled();
      expect(mockMutateCampaign).toHaveBeenCalled();
    });
  });
});
