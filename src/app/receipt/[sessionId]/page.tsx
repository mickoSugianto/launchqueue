"use client";

import { useParams, useRouter } from "next/navigation";
import { useCheckout } from "@/lib/hooks/useCheckout";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { CheckCircle2, Package, Truck, Home } from "lucide-react";
import { useEffect, useState } from "react";

// THE VALID STATES THAT ARE ALLOWED TO VIEW THIS PAGE
const VALID_RECEIPT_STATUSES = [
  "PAYMENT_VERIFIED",
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "SHIPPED",
];

export default function ReceiptPage() {
  // DELAY PROGRESS LINE TRANSITION
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const params = useParams<{ sessionId: string }>();
  const router = useRouter();

  // FETCH THE HYDRATED ORDER
  const { order, isLoading, isError } = useCheckout(params.sessionId);

  // GATEKEEPER: LOADING
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm font-medium tracking-widest uppercase animate-pulse text-zinc-400">
          Retrieving Order...
        </p>
      </div>
    );
  }

  // GATEKEEPER: INVALID, EXPIRED, OR UNPAID ORDERS
  if (!isError || !order || !VALID_RECEIPT_STATUSES.includes(order.status)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 space-y-4">
        <p className="text-sm font-bold tracking-widest uppercase text-red-500">
          Order Not Found or Payment Incomplete
        </p>
        <button
          onClick={() => router.push("/")} // TO BLANK PAGE FOR NOW
          className="text-xs font-medium underline text-zinc-500 hover:text-zinc-900"
        >
          Return to Store
        </button>
      </div>
    );
  }

  // DYNAMIC TIMELINE LOGIC
  const timelineSteps = [
    { key: "PAYMENT_VERIFIED", label: "Paid", icon: CheckCircle2 },
    { key: "IN_PRODUCTION", label: "In Production", icon: Package },
    { key: "READY_TO_SHIP", label: "Ready to Ship", icon: Truck },
    { key: "SHIPPED", label: "Shipped", icon: Home },
  ];

  const currentStepIndex = timelineSteps.findIndex(
    (step) => step.key === order.status,
  );
  const currentStepStyle = ["w-0", "w-1/3", "w-2/3", "w-full"];

  return (
    <div>
      {/* SIMPLE HEADER */}
      <header className="w-full border-b border-zinc-200 py-6 px-4 md:px-8 flex justify-center bg-white">
        <h1 className="text-sm font-bold tracking-widest uppercase">
          LaunchQueue
        </h1>
      </header>
      {/* MAIN */}
      <main className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 md:p-8 items-start mt-4 md:mt-8">
        {/* LEFT COLUMN: TIMELINE & DETAILS (60% OR 7/12) */}
        <div className="lg:col-span-7 space-y-8">
          {/* VICTORY HEADER */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <h2 className="text-3xl font-black tracking-widest uppercase">
                Order Confirmed
              </h2>
            </div>
            <p className="text-sm text-zinc-500 font-medium">
              Thank you, {order.customer.name.split(" ")[0]}. Your order has
              been received and is being processed.
            </p>
          </div>
          {/* DYNAMIC TRACKING TIMELINE */}
          <div className="bg-white border border-zinc-200 rounded-sm p-6 md:p-8">
            <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-8">
              Order Status
            </h3>
            <div className="flex justify-between items-center relative z-0">
              {/* BACKGROUND LINE */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-100 -z-10" />
              {/* PROGRESS LINE */}
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-zinc-900 -z-10 transition-all duration-3000 ${isMounted ? currentStepStyle[currentStepIndex] || "w-0" : "w-0"}`}
              />
              {timelineSteps.map((step, index) => {
                const isActive = isMounted && index <= currentStepIndex;
                const Icon = step.icon;

                const delayMs = index * 1000;

                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center gap-3 bg-white px-2 z-10"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${isActive ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-300"}`}
                      style={{ transitionDelay: `${delayMs}ms` }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[10px] font-bold tracking-widest uppercase transition-colors duration-500 ${isActive ? "text-zinc-900" : "text-zinc-400"}`}
                      style={{ transitionDelay: `${delayMs}ms` }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* CUSTOMER SHIPPING DETAILS */}
          <div className="bg-white border border-zinc-200 rounded-sm p-6 md:p-8 space-y-6">
            <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-400">
              Shipping Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="font-bold mb-1">Contact</p>
                <p className="text-zinc-600">{order.customer.email}</p>
                <p className="text-zinc-600">{order.customer.whatsapp}</p>
              </div>
              <div>
                <p className="font-bold mb-1">Address</p>
                <p className="text-zinc-600">{order.customer.name}</p>
                <p className="text-zinc-600">{order.customer.address}</p>
                <p className="text-zinc-600">
                  {order.customer.city}, {order.customer.postalCode}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* RIGHT COLUMN: REUSING ORDER SUMMARY (40% OR 5/12) */}
        <div className="lg:col-span-5 lg:sticky lg:top-8">
          <OrderSummary order={order} />
        </div>
      </main>
    </div>
  );
}
