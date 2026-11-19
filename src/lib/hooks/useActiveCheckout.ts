import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { Order } from "@/types";
import { apiFetch } from "@/lib/apiFetch";

const ACTIVE_CHECKOUT_KEY = "/api/checkout/active";

const fetcher = async (url: string): Promise<Order[]> => {
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch active checkout sessions");
  }
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as Order[]) : [];
};

export function useActiveCheckout(campaignId?: string) {
  const { data, error, isLoading, mutate } = useSWR<Order[]>(
    ACTIVE_CHECKOUT_KEY,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "dbOrders" || event.key === null) {
        void mutate();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [mutate]);

  const activeOrders = useMemo(() => {
    const orders = data ?? [];
    if (!campaignId) return orders;
    return orders.filter((order) => order.campaignId === campaignId);
  }, [data, campaignId]);

  return {
    activeOrder: activeOrders[0] ?? null,
    activeOrders,
    isLoading,
    isError: error,
    mutate,
  };
}
