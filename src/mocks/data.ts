import { Campaign, ShippingRates } from "../types";

export const mockShippingRates: ShippingRates = {
  Jakarta: 9000,
  Bandung: 11000,
  Surabaya: 19000,
  Bali: 25000,
  Medan: 30000,
};

const tomorrow = new Date(Date.now() + 86400000);
const expectedDel = new Date(Date.now() + 86400000 * 22);

export const mockCampaign: Campaign = {
  id: "camp_kith_jkt_001",
  brandId: "brand_kith_official",
  title: "KITH x Jakarta - Heavyweight Monogram Hoodie",
  slug: "jakarta-hoodie",
  dropDate: tomorrow.toISOString(),
  productionTime: 21,
  expectedDelivery: expectedDel.toISOString(),
  isActive: true,
  heroImages: [
    "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1614975059251-992f11792b9f?auto=format&fit=crop&w=1200&q=80",
  ],
  variants: [
    {
      id: "var_kith_blk_m",
      name: "Heavyweight Monogram Hoodie",
      color: "Washed Black",
      size: "M",
      price: 2500000,
      totalInventory: 30,
      availableInventory: 30,
      weightKG: 1.2, // Heavyweight hoodies are heavy!
      maxPurchase: 1, // Strict anti-scalper limit
    },
    {
      id: "var_kith_blk_l",
      name: "Heavyweight Monogram Hoodie",
      color: "Washed Black",
      size: "L",
      price: 2500000,
      totalInventory: 30,
      availableInventory: 2, // Simulating a size that is about to sell out immediately
      weightKG: 1.25,
      maxPurchase: 1,
    },
    {
      id: "var_kith_cream_m",
      name: "Heavyweight Monogram Hoodie",
      color: "Oatmeal Cream",
      size: "M",
      price: 2500000,
      totalInventory: 20,
      availableInventory: 0, // Simulating a COMPLETELY SOLD OUT variant
      weightKG: 1.2,
      maxPurchase: 1,
    },
  ],
};
