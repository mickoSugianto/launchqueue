"use client";

import { useParams, useRouter } from "next/navigation";
import { useCheckout } from "@/lib/hooks/useCheckout";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { CheckoutTimer } from "@/components/checkout/CheckoutTimer";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { AddressForm } from "@/components/checkout/AddressForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { ShippingRates } from "@/types";
import { apiFetch } from "@/lib/apiFetch";
import { markCheckoutLeft } from "@/lib/checkoutStorage";

type AbandonIntent = "home" | "back" | null;

export default function CheckoutPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();

  // FETCH THE ORDER
  const { order, isLoading, isError, isSessionInvalid, mutate } = useCheckout(
    params.sessionId,
  );

  // STATES FOR SHIPPING RATES, SELECTED CITY, LOCAL EXPIRY, AND ABANDONMENT MODAL
  const [rates, setRates] = useState<ShippingRates>({});
  const [dynamicCity, setDynamicCity] = useState<string>("");
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [hasExitedCleanly, setHasExitedCleanly] = useState(false);
  const [abandonIntent, setAbandonIntent] = useState<AbandonIntent>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const isGuarded =
    order?.status === "AWAITING_PAYMENT" &&
    !hasTimedOut &&
    !isSessionInvalid &&
    !hasExitedCleanly;

  const isGuardedRef = useRef(false);
  const hasExitedCleanlyRef = useRef(false);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const canGoBackRef = useRef(false);
  const removeListenersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isGuardedRef.current = isGuarded;
    sessionIdRef.current = order?.id;
  }, [isGuarded, order?.id]);

  const handleTimerExpire = useCallback(() => {
    setHasTimedOut(true);
    setAbandonIntent(null);
    void mutate();
  }, [mutate]);

  const handleCheckoutComplete = useCallback(() => {
    hasExitedCleanlyRef.current = true;
    isGuardedRef.current = false;
    setHasExitedCleanly(true);
    setAbandonIntent(null);
    removeListenersRef.current?.();
  }, []);

  // FETCH THE RATES
  useEffect(() => {
    apiFetch("/api/shipping-rates")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load shipping rates");
        return res.json();
      })
      .then((data) => setRates(data))
      .catch((err) => {
        console.warn("Unable to fetch shipping rates, using fallback:", err);
      });
  }, []);

  // REDIRECT COMPLETED ORDERS TO RECEIPT (NEVER REDIRECT EXPIRED OR CANCELLED)
  useEffect(() => {
    if (
      !hasExitedCleanly &&
      order &&
      order.status !== "AWAITING_PAYMENT" &&
      order.status !== "EXPIRED" &&
      order.status !== "CANCELLED"
    ) {
      router.replace(`/receipt/${order.id}`);
    }
  }, [hasExitedCleanly, order, router]);

  // REGISTER NAVIGATION / UNLOAD GUARDS WHILE AWAITING_PAYMENT
  useEffect(() => {
    if (!isGuarded || typeof window === "undefined") {
      removeListenersRef.current = null;
      return;
    }

    if (!window.history.state?.checkoutGuard) {
      window.history.pushState(
        { ...(window.history.state ?? {}), checkoutGuard: true },
        "",
      );
    }

    let hasPriorRoute = false;
    try {
      hasPriorRoute = sessionStorage.getItem("lq:hasPriorRoute") === "1";
    } catch {
      hasPriorRoute = false;
    }

    let hasSameOriginReferrer = false;
    try {
      if (document.referrer) {
        const refUrl = new URL(document.referrer);
        hasSameOriginReferrer =
          refUrl.origin === window.location.origin &&
          !refUrl.pathname.startsWith("/checkout/");
      }
    } catch {
      hasSameOriginReferrer = false;
    }

    canGoBackRef.current =
      (hasPriorRoute || hasSameOriginReferrer) && window.history.length > 2;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isGuardedRef.current || hasExitedCleanlyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      if (!isGuardedRef.current || hasExitedCleanlyRef.current) return;
      if (!window.history.state?.checkoutGuard) {
        window.history.pushState(
          { ...(window.history.state ?? {}), checkoutGuard: true },
          "",
        );
      }
      setAbandonIntent("back");
    };

    const handlePageHide = () => {
      if (!isGuardedRef.current || hasExitedCleanlyRef.current) return;
      if (sessionIdRef.current) {
        markCheckoutLeft(sessionIdRef.current);
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void mutate();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    const cleanup = () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };

    removeListenersRef.current = cleanup;
    return cleanup;
  }, [isGuarded, mutate]);

  // RECORD LEAVE TIMESTAMP ON CLIENT-SIDE UNMOUNT IF USER BYPASSED CONFIRMATION
  useEffect(() => {
    return () => {
      if (
        isGuardedRef.current &&
        !hasExitedCleanlyRef.current &&
        sessionIdRef.current
      ) {
        markCheckoutLeft(sessionIdRef.current);
      }
    };
  }, []);

  const handleConfirmAbandon = async () => {
    if (!order || isCancelling) return;
    const intent = abandonIntent;
    setIsCancelling(true);

    try {
      const res = await apiFetch(`/api/checkout/${order.id}/cancel`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Unable to cancel reservation. Please try again.");
        setIsCancelling(false);
        return;
      }

      hasExitedCleanlyRef.current = true;
      isGuardedRef.current = false;
      setHasExitedCleanly(true);
      removeListenersRef.current?.();
      setAbandonIntent(null);
      setIsCancelling(false);

      void globalMutate("/api/checkout/active");
      toast.info("Checkout cancelled. Your reserved item has been released.");

      if (intent === "back" && canGoBackRef.current) {
        window.history.go(-2);
      } else {
        router.push("/");
      }
    } catch {
      toast.error("Unable to cancel reservation. Please try again.");
      setIsCancelling(false);
    }
  };

  // CALCULATE THE DYNAMIC FEE
  const dynamicShippingFee =
    dynamicCity && rates[dynamicCity] !== undefined
      ? rates[dynamicCity]
      : order?.shippingFee;

  // LOADING STATE
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm font-medium tracking-widest uppercase animate-pulse text-zinc-400">
          Securing Session...
        </p>
      </div>
    );
  }

  // INVALID, EXPIRED, OR CANCELLED SESSION
  if (
    order?.status === "EXPIRED" ||
    order?.status === "CANCELLED" ||
    hasTimedOut ||
    isSessionInvalid
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 space-y-4">
        <p className="text-sm font-bold tracking-widest uppercase text-red-500">
          Session Expired or Invalid
        </p>
        <button
          onClick={() => router.push("/")}
          className="text-xs font-medium underline text-zinc-500 hover:text-zinc-900 cursor-pointer"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  // RECOVERABLE NETWORK / ENGINE ERROR
  if (isError || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 space-y-4 p-4">
        <p className="text-sm font-bold tracking-widest uppercase text-red-500">
          Unable to Load Checkout Session
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void mutate()}
            className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-xs font-medium underline text-zinc-500 hover:text-zinc-900 cursor-pointer"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ALREADY COMPLETED / PAID ORDER REDIRECT
  if (order.status !== "AWAITING_PAYMENT") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm font-medium tracking-widest uppercase animate-pulse text-zinc-400">
          Redirecting to Receipt...
        </p>
      </div>
    );
  }

  const availableCities = Object.keys(rates);

  // THE SECURE CHECKOUT LAYOUT
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      {/* SECURE HEADER */}
      <header className="relative w-full border-b border-zinc-200 py-6 px-4 md:px-8 flex justify-center items-center bg-white">
        <button
          type="button"
          onClick={() => setAbandonIntent("home")}
          className="absolute left-4 md:left-8 text-xs font-bold tracking-widest uppercase text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          ← Home
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <h1 className="text-sm font-bold tracking-widest uppercase">
            Secure Checkout
          </h1>
        </div>
      </header>
      {/* THE ASYMMETRICAL SPLIT SCREEN */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 md:p-8 items-start">
        {/* LEFT COLUMN: THE ADDRESS FORM (60%) */}
        <div className="lg:col-span-7 space-y-8 bg-white p-6 md:p-8 border border-zinc-200 rounded-sm">
          <div>
            <h2 className="text-xl font-bold tracking-tighter uppercase mb-1">
              Shipping Details
            </h2>
            <p className="text-xs text-zinc-500 font-medium tracking-wide">
              Please enter your destination address.
            </p>
          </div>
          <AddressForm
            sessionId={order.id}
            onCityChange={setDynamicCity}
            availableCities={
              availableCities.length > 0 ? availableCities : undefined
            }
            onExpire={handleTimerExpire}
            onComplete={handleCheckoutComplete}
          />
        </div>
        {/* RIGHT COLUMN: THE LEDGER / SUMMARY (40%) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
          <CheckoutTimer
            expiresAt={order.expiresAt}
            onExpire={handleTimerExpire}
          />
          <OrderSummary order={order} dynamicShippingFee={dynamicShippingFee} />
        </div>
      </main>

      {/* ABANDON CHECKOUT CONFIRMATION MODAL */}
      <Dialog
        open={abandonIntent !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isCancelling) {
            setAbandonIntent(null);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md rounded-sm"
          showCloseButton={!isCancelling}
          onEscapeKeyDown={(e) => {
            if (isCancelling) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isCancelling) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-zinc-900">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              Abandon Checkout?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 font-medium pt-2">
              Leaving checkout will immediately cancel your reservation and
              return this item to the drop.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-sm">
            <p className="text-sm font-bold text-zinc-900">{order.item.name}</p>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              {order.item.color} • Size {order.item.size}
            </p>
          </div>

          <DialogFooter className="border-t border-zinc-100 pt-4">
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => setAbandonIntent(null)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stay in Checkout
            </button>
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => void handleConfirmAbandon()}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-zinc-900 text-white rounded-sm hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling
                ? "Releasing Hold..."
                : abandonIntent === "home"
                  ? "Abandon & Go Home"
                  : "Abandon & Leave"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
