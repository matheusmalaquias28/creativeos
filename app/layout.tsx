import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { fontVariables, geistMono } from "@/lib/design/fonts";
import "./globals.css";

// maximumScale impede o zoom automático do iOS ao focar campos (o pinch-zoom
// continua funcionando no iOS, que ignora esse limite para gestos).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

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
