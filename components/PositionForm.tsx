"use client";

import { useState } from "react";
import {
  InstrumentType,
  INSTRUMENT_OPTIONS,
  INSTRUMENT_LABELS,
  Position,
  isOption,
  hasQuarterlyExpiry,
  hasCustomExpiry,
  EXPIRATION_MONTHS,
  ExpirationMonth,
} from "@/lib/types";

interface Props {
  onAdd: (p: Omit<Position, "id">) => void | Promise<void>;
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
  const [vencFecha, setVencFecha] = useState<string>(today());
  const [error, setError] = useState<string | null>(null);

  const isDerivative = tipo !== "equity";
  const optionSelected = isOption(tipo);
  const quarterly = hasQuarterlyExpiry(tipo);
  const custom = hasCustomExpiry(tipo);

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
    let fechaVencVal: string | undefined;

    if (optionSelected) {
      const k = Number(strike);
      if (!Number.isFinite(k) || k <= 0)
        return setError("Strike (precio de ejercicio) debe ser mayor a cero para opciones.");
      strikeVal = k;
    }

    if (quarterly) {
      mesVal = vencMes;
      anioVal = vencAnio;
    }

    if (custom) {
      if (!vencFecha) return setError("Captura la fecha de vencimiento del forward.");
      fechaVencVal = vencFecha;
    }

    onAdd({
      fecha,
      tipo,
      ticker: ticker.trim().toUpperCase(),
      posicion: pos,
      precio: px,
      strike: strikeVal,
      vencMes: mesVal,
      vencAnio: anioVal,
      vencFecha: fechaVencVal,
    });

    setTicker("");
    setPosicion("");
    setPrecio("");
    setStrike("");
  };

  const inputBase =
    "bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const labelBase = "text-xs uppercase tracking-wider text-slate-500";
  const naTag = <span className="normal-case text-slate-400">(n/a)</span>;

  return (
    <form onSubmit={submit} className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
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
            Strike {!optionSelected && naTag}
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

        {custom ? (
          <div className="flex flex-col gap-1 xl:col-span-2">
            <label className={labelBase}>Vencimiento (forward)</label>
            <input
              type="date"
              value={vencFecha}
              onChange={(e) => setVencFecha(e.target.value)}
              className={inputBase}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className={labelBase}>
                Venc. mes {!quarterly && naTag}
              </label>
              <select
                value={vencMes}
                onChange={(e) => setVencMes(e.target.value as ExpirationMonth)}
                disabled={!quarterly}
                className={inputBase}
              >
                {EXPIRATION_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelBase}>
                Venc. año {!quarterly && naTag}
              </label>
              <select
                value={vencAnio}
                onChange={(e) => setVencAnio(Number(e.target.value))}
                disabled={!quarterly}
                className={inputBase}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </>
        )}

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
          <div className="text-sm text-rose-600">{error}</div>
        ) : (
          <div className="text-xs text-slate-500">
            Multiplicador: futuros / calls / puts × 100 acciones por contrato.
          </div>
        )}
        <button
          type="submit"
          className="bg-monex text-white font-semibold rounded px-6 py-2 hover:bg-monexHover transition"
        >
          Agregar
        </button>
      </div>
    </form>
  );
}
