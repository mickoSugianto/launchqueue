import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";
import { useCampaigns } from "@/lib/hooks/useCampaigns";

jest.mock("@/lib/hooks/useCampaigns");

describe("HomePage", () => {
  // TEST A: DOES THE GATEKEEPER WORK?
  it("renders the loading state initially", () => {
    (useCampaigns as jest.Mock).mockReturnValue({
      campaigns: [],
      isLoading: true,
      isError: false,
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
    });

    render(<HomePage />);

    expect(screen.getByText("LaunchQueue")).toBeInTheDocument();
    expect(screen.getByText("Mock Hoodie")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
