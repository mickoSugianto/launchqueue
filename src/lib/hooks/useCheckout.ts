import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    const data = await res.json();
    // IF THE BACKEND SENDS AN ERROR LIKE 404 OR 410
    if (!res.ok) throw new Error(data.error || "Failed to fetch session");
    return data;
  });

export function useCheckout(sessionId: string) {
  const { data, error, isLoading } = useSWR(
    sessionId ? `/api/checkout/${sessionId}` : null,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false },
  );

  return {
    order: data,
    isLoading,
    isError: error,
  };
}
