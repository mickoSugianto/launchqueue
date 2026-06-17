import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DropPage from "@/app/(buyer)/[brand]/[slug]/page";
import { useCampaign } from "@/lib/hooks/useCampaign";
import type { ImgHTMLAttributes } from "react";
import { useEffect } from "react";

// MOCKS
// MOCK THE DATA HOOK
jest.mock("@/lib/hooks/useCampaign");

// mock the router
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ slug: "premium-heavy-knitwear" }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => {
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCampaignBase = {
    id: "camp_knit_123",
    title: "Premium Heavy Knitwear Drop",
    brandId: "kith",
    productionTime: 14,
    dropDate: "2025-06-16T00:00:00Z",
    heroImages: ["/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp"],
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
});
