"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { getGraceTargetMs } from "@/lib/checkoutStorage";
import { useActiveCheckout } from "@/lib/hooks/useActiveCheckout";

function formatRemainingTime(distanceMs: number): string {
  if (distanceMs <= 0) return "00:00";
  const totalSeconds = Math.floor(distanceMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function HoldCountdown({
  targetMs,
  onExpire,
}: {
  targetMs: number;
  onExpire: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<string>(() =>
    formatRemainingTime(targetMs - Date.now()),
  );
  const onExpireRef = useRef(onExpire);
  const hasFiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    hasFiredRef.current = false;

    const tick = () => {
      const remaining = targetMs - Date.now();
      if (remaining <= 0) {
        setTimeLeft("00:00");
        if (!hasFiredRef.current) {
          hasFiredRef.current = true;
          onExpireRef.current();
        }
        return true;
      }
      setTimeLeft(formatRemainingTime(remaining));
      return false;
    };

    if (tick()) return;

    const interval = setInterval(() => {
      if (tick()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetMs]);

  return (
    <span className="text-sm font-black tracking-tight tabular-nums text-amber-950">
      {timeLeft}
    </span>
  );
}

export function ActiveCheckoutBanner({
  campaignId,
  onRefreshCampaign,
  className = "",
}: {
  campaignId?: string;
  onRefreshCampaign?: () => void;
  className?: string;
}) {
  const { activeOrder, mutate } = useActiveCheckout(campaignId);
  const [isReleasing, setIsReleasing] = useState(false);

  const handleExpired = useCallback(() => {
    void mutate();
    onRefreshCampaign?.();
  }, [mutate, onRefreshCampaign]);

  if (!activeOrder) {
    return null;
  }

  const targetMs = getGraceTargetMs(activeOrder);
  const hasLeftCheckout = Boolean(activeOrder.leftAt);

  const handleReleaseHold = async () => {
    if (isReleasing) return;
    setIsReleasing(true);

    try {
      const res = await apiFetch(`/api/checkout/${activeOrder.id}/cancel`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Unable to cancel reservation. Please try again.");
        return;
      }

      toast.info("Checkout cancelled. Your reserved item has been released.");
      await mutate();
      onRefreshCampaign?.();
    } catch {
      toast.error("Unable to cancel reservation. Please try again.");
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <section
      aria-label="Active checkout reservation"
      className={`border border-amber-300 bg-amber-50/90 rounded-sm p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-amber-900">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-widest">
            Active Checkout Hold
          </span>
          <span className="text-zinc-400">•</span>
          <HoldCountdown
            key={`${activeOrder.id}:${targetMs}`}
            targetMs={targetMs}
            onExpire={handleExpired}
          />
        </div>
        <p className="text-sm font-bold text-zinc-900">
          {activeOrder.item.name} — {activeOrder.item.color} / Size{" "}
          {activeOrder.item.size}
        </p>
        <p className="text-xs text-amber-900/80 font-medium">
          {hasLeftCheckout
            ? "You left checkout without completing. Resume before the 3-minute grace window expires or release your hold."
            : "You have an active checkout hold. Resume checkout or release your hold to pick a different option."}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/checkout/${activeOrder.id}`}
          className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-zinc-800 transition-colors"
        >
          Resume Checkout
        </Link>
        <button
          type="button"
          disabled={isReleasing}
          onClick={() => void handleReleaseHold()}
          className="px-4 py-2 bg-white border border-zinc-300 text-zinc-900 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isReleasing ? "Releasing..." : "Release Hold"}
        </button>
      </div>
    </section>
  );
}
