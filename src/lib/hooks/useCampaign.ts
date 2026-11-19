import useSWR from "swr";
import { Campaign } from "@/types";
import { apiFetch } from "@/lib/apiFetch";

const fetcher = (url: string) =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
  });

export function useCampaign(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<Campaign>(
    slug ? `/api/campaigns/${slug}` : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true },
  );

  return {
    campaign: data,
    isLoading,
    isError: error,
    mutate,
  };
}
