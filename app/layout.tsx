import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Dashboard de Posiciones — Monex DVV",
  description: "Dashboard para posiciones abiertas de equity, opciones, futuros y forwards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-slate-900">
        <Header />
        {children}
      </body>
    </html>
  );
}
