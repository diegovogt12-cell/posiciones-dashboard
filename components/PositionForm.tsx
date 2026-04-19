"use client";

import { useState } from "react";
import {
  InstrumentType,
  INSTRUMENT_OPTIONS,
  INSTRUMENT_LABELS,
  Position,
  isOption,
  EXPIRATION_MONTHS,
  ExpirationMonth,
} from "@/lib/types";

interface Props {
  onAdd: (p: Position) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear + i);

export default function PositionForm({ onAdd }: Props) {
  const [fecha, setFecha] = useState(today());
  const [tipo, setTipo] = useState<InstrumentType>("equity");
  const [ticker, setTicker] = useState("");
  const [posicion, setPosicion] = useState("");
  const [precio, setPrecio] = useState("");
  const [strike, setStrike] = useState("");
  const [vencMes, setVencMes] = useState<ExpirationMonth>("MAR");
  const [vencAnio, setVencAnio] = useState<number>(currentYear);
  const [error, setError] = useState<string | null>(null);

  const isDerivative = tipo !== "equity";
  const optionSelected = isOption(tipo);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pos = Number(posicion);
    const px = Number(precio);
    if (!fecha) return setError("Captura la fecha.");
    if (!ticker.trim()) return setError("Captura el ticker / emisora.");
    if (!Number.isFinite(pos) || pos === 0)
      return setError("Posición debe ser un número distinto de cero (+ largo / - corto).");
    if (!Number.isFinite(px) || px < 0)
      return setError("Precio debe ser un número no negativo.");

    let strikeVal: number | undefined;
    let mesVal: ExpirationMonth | undefined;
    let anioVal: number | undefined;

    if (optionSelected) {
      const k = Number(strike);
      if (!Number.isFinite(k) || k <= 0)
        return setError("Strike (precio de ejercicio) debe ser mayor a cero para opciones.");
      strikeVal = k;
      mesVal = vencMes;
      anioVal = vencAnio;
    }

    onAdd({
      id: crypto.randomUUID(),
      fecha,
      tipo,
      ticker: ticker.trim().toUpperCase(),
      posicion: pos,
      precio: px,
      strike: strikeVal,
      vencMes: mesVal,
      vencAnio: anioVal,
    });

    setTicker("");
    setPosicion("");
    setPrecio("");
    setStrike("");
  };

  const inputBase =
    "bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed";
  const labelBase = "text-xs uppercase tracking-wider text-slate-400";

  return (
    <form onSubmit={submit} className="bg-panel rounded-lg p-5 border border-slate-800">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        <div className="flex flex-col gap-1">
          <label className={labelBase}>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputBase}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelBase}>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as InstrumentType)}
            className={inputBase}
          >
            {INSTRUMENT_OPTIONS.map((t) => (
              <option key={t} value={t}>{INSTRUMENT_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelBase}>{isDerivative ? "Subyacente" : "Emisora"}</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="AMXL, WALMEX, ..."
            className={`${inputBase} uppercase`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelBase}>
            Strike {!optionSelected && <span className="normal-case text-slate-600">(n/a)</span>}
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={optionSelected ? strike : ""}
            onChange={(e) => setStrike(e.target.value)}
            disabled={!optionSelected}
            placeholder={optionSelected ? "0.00" : "—"}
            className={inputBase}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelBase}>
            Venc. mes {!optionSelected && <span className="normal-case text-slate-600">(n/a)</span>}
          </label>
          <select
            value={vencMes}
            onChange={(e) => setVencMes(e.target.value as ExpirationMonth)}
            disabled={!optionSelected}
            className={inputBase}
          >
            {EXPIRATION_MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelBase}>
            Venc. año {!optionSelected && <span className="normal-case text-slate-600">(n/a)</span>}
          </label>
          <select
            value={vencAnio}
            onChange={(e) => setVencAnio(Number(e.target.value))}
            disabled={!optionSelected}
            className={inputBase}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelBase}>
            Posición {isDerivative ? "(contratos)" : "(títulos)"}
          </label>
          <input
            type="number"
            step="any"
            value={posicion}
            onChange={(e) => setPosicion(e.target.value)}
            placeholder="+ largo / - corto"
            className={inputBase}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelBase}>{optionSelected ? "Prima" : "Precio"}</label>
          <input
            type="number"
            step="any"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0.00"
            className={inputBase}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        {error ? (
          <div className="text-sm text-rose-400">{error}</div>
        ) : (
          <div className="text-xs text-slate-500">
            Multiplicador de contrato: futuros / calls / puts × 100 acciones.
          </div>
        )}
        <button
          type="submit"
          className="bg-accent text-slate-900 font-semibold rounded px-6 py-2 hover:bg-sky-300 transition"
        >
          Agregar
        </button>
      </div>
    </form>
  );
}
