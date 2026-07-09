import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { AmbientBackground } from "@/components/layout/ambient-background";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Creative OS",
    template: "%s · Creative OS",
  },
  description:
    "Plataforma interna de geração criativa automatizada para agências de marketing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="relative min-h-full font-sans">
        <AmbientBackground />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
