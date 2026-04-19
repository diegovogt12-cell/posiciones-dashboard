/**
 * Barra superior azul Monex.
 *
 * LOGO: Reemplazo sugerido cuando tengas el archivo real —
 *   - Guarda el SVG/PNG en /public/monex-logo.svg (o .png)
 *   - Sustituye el <span> de placeholder por:
 *       import Image from "next/image";
 *       <Image src="/monex-logo.svg" alt="Monex" width={110} height={28} priority />
 */
export default function Header() {
  return (
    <header className="bg-monex text-white">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Placeholder tipográfico del logo */}
        <span className="text-2xl font-bold lowercase tracking-tight select-none">
          monex
        </span>
        <span className="text-lg font-semibold tracking-[0.25em]">DVV</span>
      </div>
    </header>
  );
}
