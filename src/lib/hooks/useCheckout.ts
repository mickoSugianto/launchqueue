import { useEffect } from "react";
import useSWR from "swr";
import { Order } from "@/types";
import { apiFetch } from "@/lib/apiFetch";

export class CheckoutFetchError extends Error {
  status: number;
  code?: string;
  isSessionInvalid: boolean;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CheckoutFetchError";
    this.status = status;
    this.code = code;
    this.isSessionInvalid =
      status === 410 ||
      code === "SESSION_EXPIRED" ||
      code === "SESSION_CANCELLED" ||
      code === "SESSION_NOT_FOUND";
  }
}

const fetcher = async (url: string) => {
  const res = await apiFetch(url);
  const contentType = res.headers?.get?.("content-type") ?? "";
  let data: Record<string, unknown> | null = null;

  if (
    typeof res.json === "function" &&
    (!res.headers || contentType.toLowerCase().includes("application/json"))
  ) {
    data = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
  }

  if (!res.ok) {
    const errorCode =
      typeof data?.error === "string" ? data.error : undefined;
    throw new CheckoutFetchError(
      errorCode || "Failed to fetch session",
      res.status,
      errorCode,
    );
  }

  if (!data) {
    throw new CheckoutFetchError("Invalid response format", res.status);
  }

  return data as unknown as Order;
};

export function useCheckout(sessionId: string) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Order>(
    sessionId ? `/api/checkout/${sessionId}` : null,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "dbOrders" || event.key === null) {
        void mutate();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [sessionId, mutate]);

  const isSessionInvalid =
    error instanceof CheckoutFetchError ? error.isSessionInvalid : false;

  return {
    order: data,
    isLoading,
    isValidating,
    isError: error,
    isSessionInvalid,
    mutate,
  };
}
