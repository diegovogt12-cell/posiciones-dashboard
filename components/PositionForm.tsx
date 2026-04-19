"use client";

import { useState } from "react";
import {
  InstrumentType,
  INSTRUMENT_OPTIONS,
  INSTRUMENT_LABELS,
  Position,
  isOption,
} from "@/lib/types";

interface Props {
  onAdd: (p: Position) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function PositionForm({ onAdd }: Props) {
  const [fecha, setFecha] = useState(today());
  const [tipo, setTipo] = useState<InstrumentType>("equity");
  const [ticker, setTicker] = useState("");
  const [posicion, setPosicion] = useState("");
  const [precio, setPrecio] = useState("");
  const [strike, setStrike] = useState("");
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
    if (optionSelected) {
      const k = Number(strike);
      if (!Number.isFinite(k) || k <= 0)
        return setError("Strike (precio de ejercicio) debe ser mayor a cero para opciones.");
      strikeVal = k;
    }

    onAdd({
      id: crypto.randomUUID(),
      fecha,
      tipo,
      ticker: ticker.trim().toUpperCase(),
      posicion: pos,
      precio: px,
      strike: strikeVal,
    });

    setTicker("");
    setPosicion("");
    setPrecio("");
    setStrike("");
  };

  return (
    <form
      onSubmit={submit}
      className="bg-panel rounded-lg p-5 border border-slate-800 grid gap-4 md:grid-cols-7"
    >
      <div className="flex flex-col gap-1 md:col-span-1">
        <label className="text-xs uppercase tracking-wider text-slate-400">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1 md:col-span-1">
        <label className="text-xs uppercase tracking-wider text-slate-400">Tipo</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as InstrumentType)}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-accent"
        >
          {INSTRUMENT_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {INSTRUMENT_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 md:col-span-1">
        <label className="text-xs uppercase tracking-wider text-slate-400">
          {isDerivative ? "Subyacente" : "Emisora"}
        </label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="AMXL, WALMEX, ..."
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 uppercase focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1 md:col-span-1">
        <label className="text-xs uppercase tracking-wider text-slate-400">
          Strike {optionSelected ? "" : <span className="normal-case text-slate-600">(n/a)</span>}
        </label>
        <input
          type="number"
          step="any"
          min="0"
          value={optionSelected ? strike : ""}
          onChange={(e) => setStrike(e.target.value)}
          disabled={!optionSelected}
          placeholder={optionSelected ? "0.00" : "—"}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex flex-col gap-1 md:col-span-1">
        <label className="text-xs uppercase tracking-wider text-slate-400">
          Posición {isDerivative ? "(contratos)" : "(títulos)"}
        </label>
        <input
          type="number"
          step="any"
          value={posicion}
          onChange={(e) => setPosicion(e.target.value)}
          placeholder="+ largo / - corto"
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1 md:col-span-1">
        <label className="text-xs uppercase tracking-wider text-slate-400">
          {optionSelected ? "Prima" : "Precio"}
        </label>
        <input
          type="number"
          step="any"
          min="0"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="0.00"
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex items-end md:col-span-1">
        <button
          type="submit"
          className="w-full bg-accent text-slate-900 font-semibold rounded px-4 py-2 hover:bg-sky-300 transition"
        >
          Agregar
        </button>
      </div>

      {error && <div className="md:col-span-7 text-sm text-rose-400">{error}</div>}
    </form>
  );
}
