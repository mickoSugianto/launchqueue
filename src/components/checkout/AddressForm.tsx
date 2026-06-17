"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// THE ZOD SCHEMA: STRICT VALIDATION RULES
const checkoutSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  whatsapp: z.string().min(10, "Whatsapp number must be at least 10 digits"),
  shippingAddress: z.string().min(10, "Please enter your full street address"),
  city: z.enum(["Jakarta", "Bandung", "Surabaya", "Bali", "Medan"], {
    message: "Please select a valid shipping destination",
  }),
  postalCode: z.string().min(5, "Postal code must be at least 5 digits"),
});

// INFER THE TYPESCRIPT TYPE DIRECTLY FROM THE ZOD SCHEMA
type CheckoutFormData = z.infer<typeof checkoutSchema>;

export function AddressForm({
  sessionId,
  onCityChange,
}: {
  sessionId: string;
  onCityChange: (city: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (selectedCity) {
      onCityChange(selectedCity);
    }
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

      const responseData = await res.json();

      if (!res.ok) {
        // IF THE TIMER EXPIRED, THE BACKEND KICKS THEM OUT
        alert(responseData.error || "Checkout failed.");
        router.push("/");
        return;
      }

      // SUCCESS!!
      router.push(responseData.receiptUrl);
    } catch (error) {
      console.error("Network Error:", error);
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
            <option value="Jakarta">Jakarta</option>
            <option value="Bandung">Bandung</option>
            <option value="Surabaya">Surabaya</option>
            <option value="Bali">Bali</option>
            <option value="Medan">Medan</option>
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
