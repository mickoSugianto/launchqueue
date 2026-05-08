import useSWR from "swr";
import { Order } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useAdminOrders() {
  const { data, mutate, error, isLoading } = useSWR(
    "/api/admin/orders",
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false },
  );

  const activeOrders =
    data?.filter(
      (o: Order) => o.status !== "AWAITING_PAYMENT" && o.status !== "EXPIRED",
    ) || [];

  return {
    rawOrders: data,
    activeOrders: activeOrders,
    mutate,
    isLoading,
    isError: error,
  };
}
