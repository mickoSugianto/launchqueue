"use client";

import { time } from "console";
import { useEffect, useState } from "react";

interface DropCountdownProps {
  dropDate: string;
  onLive: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function DropCountdown({ dropDate, onLive }: DropCountdownProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // MARK AS SAFE TO RENDER
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // THE MATH ENGINE
  useEffect(() => {
    if (!isMounted) return;

    const targetDate = new Date(dropDate).getTime();

    const calculateTime = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      // IF TIME IS UP, STOP THE CLOCK AND UNLOCK THE PAGE; RETURN TRUE
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        onLive();
        return true;
      }

      // OTHERWISE, SET THE TIMELEFT; RETURN FALSE
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        ),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
      return false;
    };

    // RUN ONCE IMMEDIATELY TO AVOID A 1-SECOND DELAY FLASH
    const isOver = calculateTime();
    if (isOver) return;

    // START THE INTERVAL
    const timer = setInterval(() => {
      const finished = calculateTime();
      if (finished) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [dropDate, isMounted, onLive]);

  // RENDER FALLBACK
  if (!isMounted) {
    return (
      <div className="text-3xl font-mono tracking-tighter text-zinc-300 animate-pulse">
        00:00:00
      </div>
    );
  }

  // FORMATTING HELPER
  const pad = (num: number) => num.toString().padStart(2, "0");

  return (
    <div className="flex gap-4 items-center">
      {timeLeft.days > 0 && (
        <>
          <div className="flex flex-col text-center w-12">
            <span className="text-3xl font-bold tracking-tighter">
              {pad(timeLeft.days)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Days
            </span>
          </div>
          <span className="text-2xl font-bold text-zinc-300 pb-3">:</span>
        </>
      )}
      <div className="flex flex-col text-center w-12">
        <span className="text-3xl font-bold tracking-tighter">
          {pad(timeLeft.hours)}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Hrs
        </span>
      </div>
      <span className="text-2xl font-bold text-zinc-300 pb-3">:</span>
      <div className="flex flex-col text-center w-12">
        <span className="text-3xl font-bold tracking-tighter">
          {pad(timeLeft.minutes)}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Min
        </span>
      </div>
      <span className="text-2xl font-bold text-zinc-300 pb-3">:</span>
      <div className="flex flex-col text-center w-12 text-zinc-900">
        <span className="text-3xl font-bold tracking-tighter">
          {pad(timeLeft.seconds)}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Sec
        </span>
      </div>
    </div>
  );
}
