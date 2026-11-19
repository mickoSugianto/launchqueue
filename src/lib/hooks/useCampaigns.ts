import useSWR from "swr";
import { Campaign } from "@/types";
import { apiFetch } from "@/lib/apiFetch";

const fetcher = (url: string) =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
  });

export function useCampaigns() {
  const { data, error, isLoading, mutate } = useSWR<Campaign[]>(
    "/api/campaigns",
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true },
  );

  return {
    campaigns: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
