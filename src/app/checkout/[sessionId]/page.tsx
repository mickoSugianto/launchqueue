"use client";

import { useParams, useRouter } from "next/navigation";
import { useCheckout } from "@/lib/hooks/useCheckout";
import { ShieldCheck } from "lucide-react"; // shadcn uses lucide-react for icons
import { CheckoutTimer } from "@/components/checkout/CheckoutTimer";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { AddressForm } from "@/components/checkout/AddressForm";
import { useEffect, useState } from "react";
import { ShippingRates } from "@/types";

export default function CheckoutPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();

  // FETCH THE ORDER
  const { order, isLoading, isError } = useCheckout(params.sessionId);

  // STATES FOR SHIPPING RATES AND SELECTED CITY
  const [rates, setRates] = useState<ShippingRates>({});
  const [dynamicCity, setDynamicCity] = useState<string>("");

  // FETCH THE RATES
  useEffect(() => {
    fetch("/api/shipping-rates")
      .then((res) => res.json())
      .then((data) => setRates(data));
  }, []);

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

  // INVALID OR EXPIRED SESSION
  if (isError || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 space-y-4">
        <p className="text-sm font-bold tracking-widest uppercase text-red-500">
          Session Expired or Invalid
        </p>
        <button
          onClick={() => router.push("/")}
          className="text-xs font-medium underline text-zinc-500 hover:text-zinc-900"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  // THE SECURE CHECKOUT LAYOUT
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      {/* SECURE HEADER */}
      <header className="w-full border-b border-zinc-200 py-6 px-4 md:px-8 flex justify-center items-center bg-white">
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
          <AddressForm sessionId={order.id} onCityChange={setDynamicCity} />
        </div>
        {/* RIGHT COLUMN: THE LEDGER / SUMMARY (40%) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
          <CheckoutTimer expiresAt={order.expiresAt} />
          <OrderSummary order={order} dynamicShippingFee={dynamicShippingFee} />
        </div>
      </main>
    </div>
  );
}
