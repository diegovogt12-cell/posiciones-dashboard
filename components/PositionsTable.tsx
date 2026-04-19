"use client";

import { INSTRUMENT_LABELS, Position, notional } from "@/lib/types";
import { formatMoney, formatNumber } from "@/lib/format";

interface Props {
  positions: Position[];
  onDelete: (id: string) => void;
}

export default function PositionsTable({ positions, onDelete }: Props) {
  if (positions.length === 0) {
    return (
      <div className="bg-panel border border-slate-800 rounded-lg p-8 text-center text-slate-400">
        Aún no hay posiciones capturadas.
      </div>
    );
  }

  const sorted = [...positions].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="bg-panel border border-slate-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400 uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-left px-4 py-3">Tipo</th>
            <th className="text-left px-4 py-3">Ticker</th>
            <th className="text-right px-4 py-3">Posición</th>
            <th className="text-right px-4 py-3">Precio</th>
            <th className="text-right px-4 py-3">Nocional</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const long = p.posicion >= 0;
            const noc = notional(p);
            return (
              <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                <td className="px-4 py-3">{p.fecha}</td>
                <td className="px-4 py-3">{INSTRUMENT_LABELS[p.tipo]}</td>
                <td className="px-4 py-3 font-mono">{p.ticker}</td>
                <td className={`px-4 py-3 text-right font-mono ${long ? "text-emerald-400" : "text-rose-400"}`}>
                  {long ? "+" : ""}{formatNumber(p.posicion)}
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(p.precio)}</td>
                <td className={`px-4 py-3 text-right font-mono ${noc >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatMoney(noc)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(p.id)}
                    className="text-slate-500 hover:text-rose-400 text-xs"
                    aria-label="Eliminar"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
