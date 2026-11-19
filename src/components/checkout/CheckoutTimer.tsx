"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

function formatRemainingTime(distanceMs: number): string {
  if (distanceMs <= 0) return "00:00";
  const minutes = Math.floor(distanceMs / 60000);
  const seconds = Math.floor((distanceMs % 60000) / 1000);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function CheckoutTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<string>(() =>
    formatRemainingTime(new Date(expiresAt).getTime() - Date.now()),
  );
  const [isExpired, setIsExpired] = useState<boolean>(
    () => new Date(expiresAt).getTime() - Date.now() <= 0,
  );

  const onExpireRef = useRef(onExpire);
  const hasFiredExpireRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    hasFiredExpireRef.current = false;
    const target = new Date(expiresAt).getTime();

    const updateTimer = () => {
      const distance = target - Date.now();

      if (distance <= 0) {
        setTimeLeft("00:00");
        setIsExpired(true);
        if (!hasFiredExpireRef.current) {
          hasFiredExpireRef.current = true;
          onExpireRef.current?.();
        }
        return true;
      }

      setIsExpired(false);
      setTimeLeft(formatRemainingTime(distance));
      return false;
    };

    const expiredImmediately = updateTimer();
    if (expiredImmediately) return;

    const interval = setInterval(() => {
      const finished = updateTimer();
      if (finished) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

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
