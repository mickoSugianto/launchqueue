import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminDashboard from "@/app/admin/page";
import { useAdminOrders } from "@/lib/hooks/useAdminOrders";

// MOCKS
// MOCK THE DATA HOOK
jest.mock("@/lib/hooks/useAdminOrders");

// MOCK THE TOAST NOTIFICATIONS (Prevents Sonner from crashing JSDOM)
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// MOCK GLOBAL FETCH
global.fetch = jest.fn();

describe("Admin Dashboard = Kanban Flow & Optimistic Mutations", () => {
  const mockMutate = jest.fn();

  const mockOrderBase = {
    id: "ord_admin_123",
    customer: {
      fullName: "Jane Doe",
      email: "jane@example.com",
    },
    item: {
      name: "Premium Heavy Knitwear",
      color: "Black",
      size: "M",
    },
    status: "PAYMENT_VERIFIED", // Starts in the first column
    totalAmount: 2500000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // set up default hook return values
    (useAdminOrders as jest.Mock).mockReturnValue({
      rawOrders: [mockOrderBase],
      activeOrders: [mockOrderBase],
      mutate: mockMutate,
      isLoading: false,
    });
  });

  // TEST 1: THE SMOKE TEST
  it("renders the kanban board and maps orders to the correct columns", () => {
    render(<AdminDashboard />);

    // Check the order details (fullName, item.name)
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/Premium Heavy Knitwear/i)).toBeInTheDocument();

    // Verify it has the correct "Advance button text"
    const advanceBtn = screen.getByRole("button", { name: /Advance/i });
    expect(advanceBtn).toBeInTheDocument();
  });

  // TEST 2: THE MODAL STATE MACHINE
  it("opens the confirmation modal with the correct next-state prediction and can be cancelled", async () => {
    const user = userEvent.setup();
    render(<AdminDashboard />);

    // Click the advance btn
    const advanceBtn = screen.getByRole("button", { name: /Advance/i });
    await user.click(advanceBtn);

    // assert the dialog opened with the correct target state ("IN PRODUCTION")
    const modalHeading = await screen.findByRole("heading", {
      name: /Confirm Advancement/i,
    });
    expect(modalHeading).toBeInTheDocument();

    const confirmationText = screen.getByText(
      /Are you sure you want to move this order to/i,
    );
    expect(confirmationText).toBeInTheDocument();
    expect(screen.getByText("IN PRODUCTION")).toBeInTheDocument();

    // click cancel
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    await user.click(cancelBtn);

    // wait for the modal to be removed from the DOM
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /Confirm Advancement/i }),
      ).not.toBeInTheDocument();
    });
  });

  // TEST 3: THE OPTIMISTIC MUTATION & NETWORK CALL
  it("optimistically updates the UI and fires the correct PATCH payload", async () => {
    const user = userEvent.setup();

    // mock the network fetch to succeed instantly
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<AdminDashboard />);

    // OPEN THE MODAL
    const advanceBtn = screen.getByRole("button", { name: /Advance/i });
    await user.click(advanceBtn);

    // Find and click the confirm button inside the modal
    const confirmBtn = await screen.findByRole("button", { name: /Confirm/i });
    await user.click(confirmBtn);

    // verify the optimistic UI update fired immediately
    expect(mockMutate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ord_admin_123",
          status: "IN_PRODUCTION",
        }),
      ]),
      false,
    );

    // verify the exact API payload was sent
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/orders/ord_admin_123",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PRODUCTION" }),
      }),
    );

    // verify the modal closed immediately
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /Confirm Advancement/i }),
      ).not.toBeInTheDocument();
    });
  });
});
