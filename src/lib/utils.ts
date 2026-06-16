import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function sanitizeBrandIdToSlug(brandId: string): string {
  return brandId
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
export function cleanBrandName(brandId: string): string {
  return brandId.replace(/[_-]+/g, " ").trim().toUpperCase();
}
