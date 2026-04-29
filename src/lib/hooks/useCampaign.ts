import useSWR from "swr";
import { Campaign } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
  });

export function useCampaign(slug: string) {
  const { data, error, isLoading } = useSWR<Campaign>(
    `/api/campaigns/${slug}`,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true },
  );

  return {
    campaign: data,
    isLoading,
    isError: error,
  };
}
