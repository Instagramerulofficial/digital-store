import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "@/components/Toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Digital Store — Premium digital products, delivered instantly",
  description:
    "Buy premium digital products — templates, ebooks, UI kits and more. Instant download after purchase, re-download anytime.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before hydration to avoid a flash. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{
            var t = localStorage.getItem('ds-theme');
            if(!t){ t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
            if(t==='dark'){ document.documentElement.classList.add('dark'); }
          }catch(e){}`}
        </Script>
      </head>
      <body
        className="min-h-screen font-sans flex flex-col"
        suppressHydrationWarning
      >
        <CartProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster />
        </CartProvider>
      </body>
    </html>
  );
}
