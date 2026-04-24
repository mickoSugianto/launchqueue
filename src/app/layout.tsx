import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { MSWProvider } from "@/components/providers/MSWProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LaunchQueue | Hype Drop Engine",
  description: "High-concurrency pre-order orchestrator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MSWProvider>{children}</MSWProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
