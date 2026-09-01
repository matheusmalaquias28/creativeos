import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { fontVariables } from "@/lib/design/fonts";
import "./globals.css";

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
      className={`${fontVariables} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="relative min-h-full font-sans">
        <AmbientBackground />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
