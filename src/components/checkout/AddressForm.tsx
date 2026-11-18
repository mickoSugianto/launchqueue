"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SUPPORTED_CITIES } from "@/lib/constants";

interface CheckoutFormData {
  fullName: string;
  email: string;
  whatsapp: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
}

export function AddressForm({
  sessionId,
  onCityChange,
  availableCities,
  onExpire,
}: {
  sessionId: string;
  onCityChange: (city: string) => void;
  availableCities?: string[];
  onExpire?: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cities = useMemo(
    () =>
      availableCities && availableCities.length > 0
        ? availableCities
        : [...SUPPORTED_CITIES],
    [availableCities],
  );

  // THE ZOD SCHEMA: STRICT VALIDATION RULES
  const checkoutSchema = useMemo(
    () =>
      z.object({
        fullName: z
          .string()
          .trim()
          .min(3, "Full name must be at least 3 characters"),
        email: z.string().trim().email("Invalid email address"),
        whatsapp: z
          .string()
          .trim()
          .regex(
            /^\+?[0-9]{10,15}$/,
            "Enter a valid 10-15 digit phone number",
          ),
        shippingAddress: z
          .string()
          .trim()
          .min(10, "Please enter your full street address"),
        city: z.string().refine((val) => cities.includes(val), {
          message: "Please select a valid shipping destination",
        }),
        postalCode: z
          .string()
          .trim()
          .regex(/^[0-9]{5}$/, "Postal code must be 5 digits"),
      }),
    [cities],
  );

  // INITIALIZE REACT HOOK FORM
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched", // validate only after the user clicks out of the box
  });

  // WATCH THE CITY INPUT
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedCity = watch("city");

  // BROADCAST IT TO THE PARENT
  useEffect(() => {
    onCityChange(selectedCity || "");
  }, [selectedCity, onCityChange]);

  // THE SUBMIT HANDLER
  const router = useRouter();
  const processCheckout = async (data: CheckoutFormData) => {
    setIsSubmitting(true);

    try {
      const payload = {
        sessionId: sessionId,
        shippingDetails: data,
      };

      const res = await fetch("/api/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409 && responseData?.receiptUrl) {
          toast.error("Order already completed. Redirecting to receipt...");
          router.replace(responseData.receiptUrl);
          return;
        }

        if (res.status === 410) {
          toast.error(responseData?.error || "Checkout session expired.");
          if (onExpire) {
            onExpire();
          } else {
            router.push("/");
          }
          return;
        }

        toast.error(
          responseData?.error || "Checkout failed. Please try again.",
        );
        return;
      }

      // SUCCESS!!
      router.push(responseData.receiptUrl);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(processCheckout)} className="space-y-6">
      {/* FULL NAME & EMAIL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="fullName"
            className="text-xs font-bold tracking-widest uppercase text-zinc-500"
          >
            Full Name
          </label>
          <input
            id="fullName"
            {...register("fullName")}
            className={`w-full p-3 border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 ${errors.fullName ? "border-red-500 bg-red-50" : "border-zinc-300 bg-zinc-50"}`}
            placeholder="John Doe"
          />
          {errors.fullName && (
            <p className="text-xs text-red-500 font-medium">
              {errors.fullName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-xs font-bold tracking-widest uppercase text-zinc-500"
          >
            Email Address
          </label>
          <input
            id="email"
            {...register("email")}
            className={`w-full p-3 border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 ${errors.email ? "border-red-500 bg-red-50" : "border-zinc-300 bg-zinc-50"}`}
            placeholder="john@example.com"
          />
          {errors.email && (
            <p className="text-xs text-red-500 font-medium">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>
      {/* PHONE NUMBER */}
      <div className="space-y-2">
        <label
          htmlFor="whatsapp"
          className="text-xs font-bold tracking-widest uppercase text-zinc-500"
        >
          Whatsapp Number
        </label>
        <input
          id="whatsapp"
          {...register("whatsapp")}
          className={`w-full p-3 border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 ${errors.whatsapp ? "border-red-500 bg-red-50" : "border-zinc-300 bg-zinc-50"}`}
          placeholder="081234567890"
        />
        {errors.whatsapp && (
          <p className="text-xs text-red-500 font-medium">
            {errors.whatsapp.message}
          </p>
        )}
      </div>
      {/* FULL ADDRESS */}
      <div className="space-y-2">
        <label
          htmlFor="shippingAddress"
          className="text-xs font-bold tracking-widest uppercase text-zinc-500"
        >
          Street Address
        </label>
        <textarea
          id="shippingAddress"
          {...register("shippingAddress")}
          rows={3}
          className={`w-full p-3 border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 ${errors.shippingAddress ? "border-red-500 bg-red-50" : "border-zinc-300 bg-zinc-50"}`}
          placeholder="Jl. Sudirman Kav 21..."
        />
        {errors.shippingAddress && (
          <p className="text-xs text-red-500 font-medium">
            {errors.shippingAddress?.message}
          </p>
        )}
      </div>
      {/* CITY & POSTAL CODE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="city"
            className="text-xs font-bold tracking-widest uppercase text-zinc-500"
          >
            City
          </label>
          <select
            id="city"
            {...register("city")}
            className={`w-full p-3 border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white cursor-pointer ${errors.city ? "border-red-500 bg-red-50" : "border-zinc-300"}`}
          >
            <option value="">Select your city...</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          {errors.city && (
            <p className="text-xs text-red-500 font-medium">
              {errors.city.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label
            htmlFor="postalCode"
            className="text-xs font-bold tracking-widest uppercase text-zinc-500"
          >
            Postal Code
          </label>
          <input
            id="postalCode"
            {...register("postalCode")}
            className={`w-full p-3 border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 ${errors.postalCode ? "border-red-500 bg-red-50" : "border-zinc-300 bg-zinc-50"}`}
            placeholder="12190"
          />
          {errors.postalCode && (
            <p className="text-xs text-red-500 font-medium">
              {errors.postalCode.message}
            </p>
          )}
        </div>
      </div>
      {/* SUBMIT BUTTON */}
      <div className="pt-6 border-t border-zinc-200">
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full bg-zinc-950 text-white font-bold uppercase tracking-widest text-sm py-4 rounded-sm hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Processing..." : "Complete Purchase"}
        </button>
      </div>
    </form>
  );
}
