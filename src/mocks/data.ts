import { Campaign, ShippingRates } from "../types";

export const mockShippingRates: ShippingRates = {
  Jakarta: 9000,
  Bandung: 11000,
  Surabaya: 19000,
  Bali: 25000,
  Medan: 30000,
};

const soon = new Date(Date.now() + 15000);
const tomorrow = new Date(Date.now() + 86400000);
const expectedDel = new Date(Date.now() + 86400000 * 22);

export const mockCampaign: Campaign = {
  id: "camp_kith_jkt_001",
  brandId: "brand_kith_official",
  title: "Kith Studded Nelson Hoodie",
  slug: "nelson-hoodie",
  dropDate: soon.toISOString(),
  productionTime: 21,
  expectedDelivery: expectedDel.toISOString(),
  isActive: true,
  heroImages: [
    "https://kith.com/cdn/shop/files/KHM034740-001-Front.jpg?v=1770156198&width=1440",
    "https://kith.com/cdn/shop/files/KHM034740-001-Detail.jpg?v=1770156198&width=1920",
    "https://kith.com/cdn/shop/files/KHM034740-001-Back.jpg?v=1770156198&width=1440",
  ],
  variants: [
    {
      id: "var_kith_blk_s",
      name: "Kith Studded Nelson Hoodie",
      color: "Black",
      size: "S",
      price: 2500000,
      totalInventory: 12,
      availableInventory: 12,
      weightKG: 1.2, // Heavyweight hoodies are heavy!
      maxPurchase: 1, // Strict anti-scalper limit
    },
    {
      id: "var_kith_blk_m",
      name: "Kith Studded Nelson Hoodie",
      color: "Black",
      size: "M",
      price: 2500000,
      totalInventory: 12,
      availableInventory: 12,
      weightKG: 1.2, // Heavyweight hoodies are heavy!
      maxPurchase: 1, // Strict anti-scalper limit
    },
    {
      id: "var_kith_blk_l",
      name: "Kith Studded Nelson Hoodie",
      color: "Black",
      size: "L",
      price: 2500000,
      totalInventory: 12,
      availableInventory: 12,
      weightKG: 1.25,
      maxPurchase: 1,
    },
  ],
};
