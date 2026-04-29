"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCampaign } from "@/lib/hooks/useCampaign";
import { DropCountdown } from "@/components/drop/DropCountdown";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function DropPage() {
  // GRAB THE URL PARAMETERS
  const params = useParams<{ brand: string; slug: string }>();

  // FEED THE SLUG INTO OUR NEW SWR HOOK
  const { campaign, isLoading, isError } = useCampaign(params.slug);

  // THE LOCK STATE
  const [isLive, setIsLive] = useState(false);
  const router = useRouter();
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [isLocking, setIsLocking] = useState(false);

  // THE NETWORK ACTION (THE RACE)
  const handleLockInventory = async () => {
    if (!selectedVariant) return;
    setIsLocking(true);

    try {
      const res = await fetch("/api/checkout/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // We pass a dummy city for now to calculate initial fake shipping
        body: JSON.stringify({ variantId: selectedVariant, city: "Jakarta" }),
      });

      const data = await res.json();

      // THE RACE CONDITION CHECK
      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Sold Out! Someone beat you to it.");
        } else if (res.status === 403) {
          toast.error("Nice try. The drop isn't active yet.");
        } else {
          toast.error("An error occurred while locking inventory.");
        }
        return;
      }

      // SUCCESS
      toast.success("Inventory Locked! You have 15 minutes to check out.");
      router.push("/checkout/${data.id}");
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLocking(false);
    }
  };

  // HANDLE THE LOADING STATE (BEFORE THE FIRST FETCH COMPLETES)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm font-medium tracking-widest uppercase animate-pulse text-zinc-400">
          Syncing with Engine...
        </p>
      </div>
    );
  }

  // HANDLE 404s OR NETWORK ERRORS
  if (isError || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-950">
        <p className="text-sm font-bold tracking-widest uppercase text-red-500">
          404 - Drop Not Found
        </p>
      </div>
    );
  }

  // THE HYPER DROP UI
  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-zinc-900 selection:text-white">
      {/* Brand Header */}
      <header className="w-full border-b border-zinc-200 py-6 px-4 md:px-8 flex justify-between items-center bg-white sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tighter uppercase italic">
          {campaign.brandId.replace("brand_", "").replace("_official", "")}
        </h1>
        <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">
          LaunchQueue Active
        </p>
      </header>

      {/* Main Split Grid */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 items-start min-h-[calc(100vh-80px)]">
        {/* Left Column: Hero Gallery */}
        <div className="border-r border-zinc-200 p-4 md:p-12 flex flex-col gap-6">
          {campaign.heroImages.map((src, idx) => (
            <div
              key={idx}
              className="relative aspect-[4/5] w-full bg-zinc-100 rounded-sm overflow-hidden"
            >
              <img
                src={src}
                alt={`${campaign.title} - View ${idx + 1}`}
                className="object-cover w-full h-full hover:scale-105 transition-transform duration-700"
              />
            </div>
          ))}
        </div>

        {/* Right Column: The Command Center (Details & Controls) */}
        <div className="p-4 md:p-12 flex flex-col justify-center max-w-md w-full mx-auto md:sticky md:top-24 h-fit">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter uppercase leading-none">
              {campaign.title}
            </h2>
            <div className="flex flex-col gap-1 text-sm font-medium text-zinc-500">
              <span className="uppercase tracking-widest">
                Ships in {campaign.productionTime} days
              </span>
              <span>
                Strict limit: {campaign.variants[0].maxPurchase} per customer
              </span>
            </div>
          </div>

          {/* DROPCOUNTDOWN */}
          <div className="mt-12 p-8 border border-dashed border-zinc-300 rounded-sm text-center bg-zinc-50/50">
            <div className="bg-zinc-50 border border-zinc-200 p-2 rounded-sm flex flex-col items-center justify-center min-h-[120px]">
              {isLive ? (
                <div className="text-center animate-in fade-in zoom-in duration-500">
                  <span className="inline-block w-2 h-2 p-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="font-bold tracking-widest uppercase text-zinc-600">
                    {" "}
                    Drop is Live
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold tracking-widest uppercase text-zinc-400">
                    Unlocks in
                  </span>
                  <DropCountdown
                    dropDate={campaign.dropDate}
                    onLive={() => setIsLive(true)}
                  />
                </div>
              )}
            </div>
            {/* THE VARIANT SELECTOR */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold tracking-widest uppercase text-zinc-500">
                  Select Size
                </Label>
                <button className="text-xs font-medium underline text-zinc-400 hover:text-zinc-900">
                  Size Guide
                </button>
              </div>
              <RadioGroup
                onValueChange={setSelectedVariant}
                className="grid grid-cols-2 gap-3 mb-4"
              >
                {campaign.variants.map((variant) => {
                  const isSoldOut = variant.availableInventory <= 0;
                  return (
                    <div key={variant.id}>
                      <RadioGroupItem
                        value={variant.id}
                        id={variant.id}
                        className="peer sr-only"
                        disabled={isSoldOut}
                      />
                      <Label
                        htmlFor={variant.id}
                        className="flex flex-col items-center justify-center rounded-sm border-2 border-zinc-200 bg-white pd-4 hover:bg-zinc-200 peer-data-[state=checked]:border-zinc-900 peer-data-[state=checked]:bg-zinc-900 peer-data-[state=checked]:text-white peer-data-[state=checked]:hover:bg-zinc-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                      >
                        <span className="text-lg font-bold">
                          {variant.color}
                        </span>
                        <span className="text-lg font-bold">
                          {variant.size}
                        </span>
                        <span className="text-[10px] uppercase font-medium mt-1">
                          {isSoldOut
                            ? "Sold Out"
                            : `${variant.availableInventory} Left`}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
            {/* THE BOUNCER BUTTON */}
            <Button
              className="w-full h-14 text-sm font-bold tracking-widest uppercase transition-all cursor-pointer"
              disabled={!isLive || !selectedVariant || isLocking}
              onClick={handleLockInventory}
            >
              {!isLive
                ? "Unlocks at Drop Time"
                : !selectedVariant
                  ? "Select a Size"
                  : isLocking
                    ? "Locking Inventory..."
                    : "Buy Now"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
