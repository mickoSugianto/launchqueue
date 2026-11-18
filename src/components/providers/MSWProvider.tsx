"use client";

import { useEffect, useState } from "react";

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false);
  const [mswError, setMswError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // EDGE CASE: MAKE SURE IT DOESN'T RUN ON THE SERVER
    if (typeof window === "undefined") return;

    let cancelled = false;

    const startMsw = async () => {
      try {
        // DYNAMICALLY IMPORT THE WORKER SO IT NEVER RUNS ON THE SERVER
        const { worker } = await import("@/mocks/browser");

        await worker.start({
          onUnhandledRequest: "bypass", // IGNORE NEXT.JS INTERNAL NETWORK TRAFFIC
        });

        if (!cancelled) {
          setMswError(null);
          setMswReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setMswError(
            error instanceof Error
              ? error.message
              : "Failed to initialize mock service worker.",
          );
        }
      }
    };

    void startMsw();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (mswError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-950 p-4">
        <div className="max-w-sm w-full border border-zinc-200 rounded-sm p-6 text-center space-y-4">
          <p className="text-xs font-bold tracking-widest uppercase text-red-500">
            Engine Initialization Failed
          </p>
          <p className="text-xs text-zinc-500 font-medium">{mswError}</p>
          <button
            type="button"
            onClick={() => {
              setMswError(null);
              setRetryCount((prev) => prev + 1);
            }}
            className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // WAIT FOR THE BOUNCER TO BE AT THE DOOR BEFORE LETTING USERS INTO THE APP
  if (!mswReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-950">
        <p className="text-sm font-medium tracking-widest uppercase animate-pulse text-zinc-400">
          Initializing Engine...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
