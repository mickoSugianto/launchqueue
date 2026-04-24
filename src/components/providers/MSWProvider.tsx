"use client";

import { useEffect, useState } from "react";

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      // DYNAMICALLY IMPORT THE WORKER SO IT NEVER RUNS ON THE SERVER
      const { worker } = await import("@/mocks/browser");

      await worker.start({
        onUnhandledRequest: "bypass", // IGNORE NEXT.JS INTERNAL NETWORK TRAFFIC
      });

      setMswReady(true);
    };
    // EDGE CASE: MAKE SURE IT DOESN'T RUN ON THE SERVER
    if (typeof window !== "undefined") {
      init();
    }
  }, []);

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
