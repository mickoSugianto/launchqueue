"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

export function CheckoutTimer({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<string>("15:00");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;

      if (distance <= 0) {
        clearInterval(interval);
        setIsExpired(true);
        // FORCE THE PAGE TO RELOAD OR REDIRECT
        router.refresh();
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(
        `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );

      return () => clearInterval(interval);
    }, 1000);
  }, [expiresAt, router]);

  if (isExpired) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-sm text-red-600">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 animate-pulse" />
        <span className="text-sm font-bold tracking-widest uppercase">
          Cart Reserved
        </span>
      </div>
      <span className="text-xl font-black tracking-tighter">{timeLeft}</span>
    </div>
  );
}
