"use client";

import Image from "next/image";
import { Order } from "@/types";

// HELPER FUNCTION TO FORMAT IDR CURRENCY
const formatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

const formatIDR = (amount: number) => formatter.format(amount);

export function OrderSummary({
  order,
  dynamicShippingFee,
}: {
  order: Order;
  dynamicShippingFee?: number;
}) {
  // EXTRACTING THE HYDRATED DATA IN MSW
  const { item, subtotal } = order;

  // RECALCULATE: IF THE PARENT GIVES A DYNAMIC FEE. OTHERWISE, USE THE DB FALLBACL
  const activeShippingFee = dynamicShippingFee ?? order.shippingFee;
  const activeTotal = subtotal + activeShippingFee;

  return (
    <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
      <div className="p-6 border-b border-zinc-100">
        <h2 className="text-sm font-bold tracking-widest uppercase mb-4">
          Order Summary
        </h2>
        {/* THE HYDRATED ITEM CARD */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-24 bg-zinc-100 rounded-sm overflow-hidden flex-shrink-0">
            <Image
              src={item.heroImage}
              alt={item.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight">{item.name}</span>
            <span className="text-xs text-zinc-500 font-medium mt-1">
              {item.color} / Size {item.size}
            </span>
            <span className="text-sm font-bold mt-2">
              {formatIDR(subtotal)}
            </span>
          </div>
        </div>
      </div>
      {/* THE LEDGER MATH */}
      <div className="p-6 space-y-3 bg-zinc-50/50 text-sm font-medium">
        <div className="flex justify-between text-zinc-500">
          <span>Subtotal</span>
          <span className="text-zinc-900">{formatIDR(subtotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>Estimated Shipping</span>
          <span className="text-zinc-900">{formatIDR(activeShippingFee)}</span>
        </div>
        <div className="pt-3 border-t border-zinc-200 flex justify-between items-center">
          <span className="font-bold tracking-widest uppercase text-xs">
            Total
          </span>
          <span className="text-lg font-black tracking-tighter">
            {formatIDR(activeTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
