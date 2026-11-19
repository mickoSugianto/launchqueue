import useSWR from "swr";
import { Order } from "@/types";
import { apiFetch } from "@/lib/apiFetch";

const fetcher = (url: string) =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch orders");
    return res.json();
  });

export function useAdminOrders() {
  const { data, mutate, error, isLoading } = useSWR(
    "/api/admin/orders",
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false },
  );

  const activeOrders =
    data?.filter(
      (o: Order) =>
        o.status !== "AWAITING_PAYMENT" &&
        o.status !== "EXPIRED" &&
        o.status !== "CANCELLED",
    ) || [];

  return {
    rawOrders: data,
    activeOrders: activeOrders,
    mutate,
    isLoading,
    isError: error,
  };
}
