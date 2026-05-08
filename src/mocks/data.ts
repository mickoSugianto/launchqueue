import { Campaign, ShippingRates } from "../types";

export const colorImageMap: Record<string, string> = {
  Black: "/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp",
  Blue: "/images/KITH_NEW_YORK_KNICKS_BLUE_FRONT.webp",
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
    "/images/KITH_NEW_YORK_KNICKS_BLACK_FRONT.webp",
    "/images/KITH_NEW_YORK_KNICKS_MENS_BLACK_FRONT.webp",
    "/images/KITH_NEW_YORK_KNICKS_MENS_BLACK_BACK.webp",
    "/images/KITH_NEW_YORK_KNICKS_BLUE_FRONT.webp",
    "/images/KITH_NEW_YORK_KNICKS_MENS_BLUE_FRONT.webp",
    "/images/KITH_NEW_YORK_KNICKS_MENS_BLUE_BACK.webp",
  ],
  sizeChart: "/images/KITH_NEW_YORK_KNICKS_SIZE_GUIDE.jpeg",
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
