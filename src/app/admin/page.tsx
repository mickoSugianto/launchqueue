"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Order } from "@/types";
import { useAdminOrders } from "@/lib/hooks/useAdminOrders";

// THE PRECISE STATE MACHINE FLOW
const STATUS_FLOW: Record<string, string | null> = {
  PAYMENT_VERIFIED: "IN_PRODUCTION",
  IN_PRODUCTION: "READY_TO_SHIP",
  READY_TO_SHIP: "SHIPPED",
  SHIPPED: null,
};

const COLUMNS = [
  { id: "PAYMENT_VERIFIED", title: "New Orders", icon: CheckCircle2 },
  { id: "IN_PRODUCTION", title: "In Production", icon: Package },
  { id: "READY_TO_SHIP", title: "Ready to Ship", icon: Package },
  { id: "SHIPPED", title: "Fulfilled", icon: Truck },
];

export default function AdminDashboard() {
  // const [orders, setOrders] = useState<any[]>([]);
  // const [isLoading, setIsLoading] = useState(true);

  const { rawOrders, orders, mutate, isLoading } = useAdminOrders();

  // STATE TO TRACK WHICH ORDER THE ADMIN CLICKED "ADVANCE" ON (MODAL)
  const [pendingOrder, setPendingOrder] = useState<{
    id: string;
    currentStatus: string;
  } | null>(null);

  // THE OPTIMISTIC UI MUTATION
  const advanceOrderStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = STATUS_FLOW[currentStatus];
    if (!nextStatus) return;

    // INSTANT MODAL DISMISSAL
    setPendingOrder(null);

    // OPTIMISTIC UI
    const optimisticData = rawOrders.map((o: Order) =>
      o.id === orderId ? { ...o, status: nextStatus } : o,
    );
    mutate(optimisticData, false);

    // FIRE THE NETWORK REQUEST IN THE BACKGROUND
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) throw new Error("Network response was not ok");

      mutate();
    } catch (error) {
      // ROLL BACK IF THE NETWORK FAILS
      console.error("Mutation failed, rolling back UI", error);
      alert("Failed to update order status. Rolling back.");

      mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-zinc-900">
            Fulfillment HQ
          </h1>
          <p className="text-sm text-zinc-500 font-medium mt-1">
            {orders.length} active orders in the pipeline
          </p>
        </div>
      </header>
      {/* THE KANBAN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.id);
          const ColIcon = col.icon;

          return (
            <div key={col.id} className="flex flex-col gap-4">
              {/* COLUMN HEADER */}
              <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
                <div className="flex items-center gap-2">
                  <ColIcon className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-900">
                    {col.title}
                  </h2>
                </div>
                <span className="bg-zinc-200 text-zinc-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {colOrders.length}
                </span>
              </div>
              {/* ORDER CARDS */}
              <div className="space-y-3">
                {colOrders.length === 0 && (
                  <div className="p-4 border border-dashed border-zinc-300 rounded-sm flex items-center justify-center bg-zinc-50/50">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
                      Empty
                    </span>
                  </div>
                )}

                {colOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white p-4 border border-zinc-200 rounded-sm shadow-sm space-y-4"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-zinc-400 tracking-widest">
                          {order.id.split("_")[1].toUpperCase()}
                        </span>
                        {order.status === "SHIPPED" ? (
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm font-bold text-zinc-900">
                        {order.customer.name}
                      </p>
                      <p className="text-xs text-zinc-500 font-medium">
                        {order.item?.name} • {order.item?.color} •{" "}
                        {order.item?.size}
                      </p>
                    </div>
                    {STATUS_FLOW[order.status] && (
                      <button
                        onClick={() =>
                          setPendingOrder({
                            id: order.id,
                            currentStatus: order.status,
                          })
                        }
                        className="w-full flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 text-xs font-bold uppercase tracking-widest py-2 rounded-sm transition-colors cursor-pointer"
                      >
                        Advance
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* THE CONFIRMATION MODAL */}
      {pendingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="bg-white max-w-sm w-full rounded-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                    Confirm Advancement
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-1">
                    Order {pendingOrder.id.split("_")[1].toUpperCase()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 font-medium">
                Are you sure you want to move this order to{" "}
                <span className="font-bold text-zinc-900">
                  {STATUS_FLOW[pendingOrder.currentStatus]?.replace(/_/g, " ")}
                </span>
                ? This action will update the customer's tracking page.
              </p>
            </div>
            <div className="bg-zinc-50 px-6 py-4 flex justify-end gap-3 border-t border-zinc-200">
              <button
                onClick={() => setPendingOrder(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  advanceOrderStatus(
                    pendingOrder.id,
                    pendingOrder.currentStatus,
                  )
                }
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-zinc-900 text-white rounded-sm hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
