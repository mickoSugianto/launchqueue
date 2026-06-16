import useSWR from "swr";
import { Campaign } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
  });

export function useCampaigns() {
  const { data, error, isLoading } = useSWR<Campaign[]>(
    "/api/campaigns",
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true },
  );

  return {
    campaigns: data || [],
    isLoading,
    isError: error,
  };
}
