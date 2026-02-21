import type { Metadata, Viewport } from "next";
import { Rethink_Sans } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const rethinkSans = Rethink_Sans({
  variable: "--font-rethink-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "The O Space",
  description:
    "The O Space helps you plan your life with circles, streaks, and a gentle AI coach.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${rethinkSans.variable} antialiased`}>
        {children}
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
