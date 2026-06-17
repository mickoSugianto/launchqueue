import "@testing-library/jest-dom";

// Mock Next.js router so our tests don't crash when components use useRouter()
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useParams() {
    return {
      brand: "kith",
      slug: "knicks-hoodie",
    };
  },
}));
