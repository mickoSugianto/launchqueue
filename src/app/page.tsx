"use client";

import Link from "next/link";
import Image from "next/image";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { ArrowRight, Activity, Terminal } from "lucide-react";
import { cleanBrandName } from "@/lib/utils";

export default function HomePage() {
  const { campaigns, isLoading, isError } = useCampaigns();

  // GATEKEEPER: LOADING
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm font-medium tracking-widest uppercase animate-pulse text-zinc-400">
          Initializing Engine...
        </p>
      </div>
    );
  }

  // GATEKEEPER: ERROR
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm font-medium tracking-widest uppercase text-red-500">
          System Failure.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <header className="pt-32 pb-20 px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1">
          <Activity className="w-3 h-3 text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            System Online
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
          LaunchQueue
        </h1>
        <p className="text-sm md:text-base text-zinc-500 max-w-2xl mx-auto font-medium leading-relaxed">
          A high-concurrency pre-order and drop orchestration engine. Built to
          demonstrate Optimistic UI, Race-Condition handling, and State
          Synchronization.
        </p>
      </header>
      <main className="max-w-5xl mx-auto px-6 pb-32">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-8 border-b border-zinc-200 pb-4">
          Active Campaigns
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => {
            const cleanBrand = cleanBrandName(campaign.brandId) || "brand";

            return (
              <Link
                key={campaign.id}
                href={`/${cleanBrand}/${campaign.slug}`}
                className="group flex flex-col bg-white border border-zinc-200 rounded-sm overflow-hidden hover:border-zinc-400 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative w-full aspect-[4/5] bg-zinc-100 overflow-hidden border-b border-zinc-100">
                  <Image
                    src={campaign.heroImages?.[0] || ""}
                    alt={campaign.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  {campaign.isActive && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-sm border border-zinc-100">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-900">
                        Live
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col flex-grow justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                      {cleanBrand}
                    </p>
                    <h3 className="text-sm font-bold text-zinc-900 mb-4">
                      {campaign.title}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 transition-colors">
                    <span>View Drop</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-zinc-500">
            <Terminal className="w-5 h-5 text-zinc-400" />
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-1">
                Developer Portal
              </p>
              <p className="text-xs font-medium">
                Access the Kanban dashboard and observe state mutations.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            target="_blank"
            className="px-6 py-3 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-zinc-800 transition-colors"
          >
            Open Admin Board
          </Link>
        </div>
      </footer>
    </div>
  );
}
