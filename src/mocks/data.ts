import { Campaign, ShippingRates } from "../types";

export const colorImageMap: Record<string, string> = {
  Black:
    "https://kith.com/cdn/shop/files/KHM034254-001-Front_125bfc94-5392-4b20-9e2b-db8b433fd562.jpg?v=1762458654&width=1440",
  Blue: "https://kith.com/cdn/shop/files/KHM034254-413-Front_3e9654ab-b6b1-4a6f-9934-354ba1d46899.jpg?v=1762458679&width=1440",
};

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
  title: "Kith for the New York Knicks",
  slug: "knicks-hoodie",
  dropDate: soon.toISOString(),
  productionTime: 21,
  expectedDelivery: expectedDel.toISOString(),
  isActive: true,
  heroImages: [
    "https://kith.com/cdn/shop/files/KHM034254-001-Front_125bfc94-5392-4b20-9e2b-db8b433fd562.jpg?v=1762458654&width=1440",
    "https://kith.com/cdn/shop/files/Final_Mens_Knicks_Ecomm_KHM034254-001_0227_fc0d38f1-3154-4062-8045-5458e35e50cd.jpg?v=1762458654&width=1440",
    "https://kith.com/cdn/shop/files/Final_Mens_Knicks_Ecomm_KHM034254-001_0228_d625beeb-7324-48bb-9dd3-d8dbeba433d5.jpg?v=1762458654&width=1440",
    "https://kith.com/cdn/shop/files/KHM034254-413-Front_3e9654ab-b6b1-4a6f-9934-354ba1d46899.jpg?v=1762458679&width=1440",
    "https://kith.com/cdn/shop/files/Final_Mens_Knicks_Ecomm_KHM034254-413_0303_a8c686c9-d760-4745-a0b3-c9b8c171101d.jpg?v=1762458679&width=1440",
    "https://kith.com/cdn/shop/files/Final_Mens_Knicks_Ecomm_KHM034254-413_0304_b2337862-0946-494f-a738-4a01bce94fce.jpg?v=1762458679&width=1440",
  ],
  variants: [
    {
      id: "var_kith_blk_s",
      name: "Kith for the New York Knicks",
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
      name: "Kith for the New York Knicks",
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
      name: "Kith for the New York Knicks",
      color: "Black",
      size: "L",
      price: 2500000,
      totalInventory: 12,
      availableInventory: 12,
      weightKG: 1.25,
      maxPurchase: 1,
    },
    {
      id: "var_kith_blue_s",
      name: "Kith for the New York Knicks",
      color: "Blue",
      size: "S",
      price: 2500000,
      totalInventory: 12,
      availableInventory: 12,
      weightKG: 1.2, // Heavyweight hoodies are heavy!
      maxPurchase: 1, // Strict anti-scalper limit
    },
    {
      id: "var_kith_blue_m",
      name: "Kith for the New York Knicks",
      color: "Blue",
      size: "M",
      price: 2500000,
      totalInventory: 12,
      availableInventory: 12,
      weightKG: 1.2, // Heavyweight hoodies are heavy!
      maxPurchase: 1, // Strict anti-scalper limit
    },
    {
      id: "var_kith_blue_l",
      name: "Kith for the New York Knicks",
      color: "Blue",
      size: "L",
      price: 2500000,
      totalInventory: 12,
      availableInventory: 12,
      weightKG: 1.25,
      maxPurchase: 1,
    },
  ],
};
