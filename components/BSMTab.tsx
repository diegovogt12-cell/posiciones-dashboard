"use client";

import { useEffect, useMemo, useState } from "react";
import { ExpirationMonth, Position, formatVencimiento } from "@/lib/types";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  groupPositions,
  opcionKey,
  filterLiveGroups,
  InstrumentGroup,
} from "@/lib/groups";
import { bsm } from "@/lib/bsm";
import { quarterlyExpiryDate } from "@/lib/business-days";

/**
 * Pestaña "BSM": calculadora de Black-Scholes-Merton para todas las opciones
 * vivas en cartera.
 *
 *   - Strike y vencimiento vienen de la opción capturada.
 *   - r es global (default 10%, editable).
 *   - q es por ticker (default 0%, editable).
 *   - spot y vol son por fila (skew + escenarios independientes).
 *
 * El usuario sólo necesita escribir spot + vol en cada fila para obtener
 * prima, delta (raw, %, acciones por contrato), gamma, vega y rho.
 */

interface Props {
  positions: Position[];
}

const CONTRACT_SIZE = 100;

// ============================================================
// Persistencia local (localStorage) — los inputs de spot, vol, r y q
// sobreviven al cambio de pestaña y al reload del navegador. Por usuario
// (cada navegador tiene su propio storage; no se comparte entre el equipo).
// ============================================================
const STORAGE_KEY = "bsm:inputs:v1";

interface StoredState {
  r: string;
  q: Record<string, string>;
  inputs: Record<string, { spot: string; vol: string }>;
}

function loadStored(): Partial<StoredState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<StoredState>) : {};
  } catch {
    return {};
  }
}

function saveStored(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage lleno o bloqueado — fallar silenciosamente
  }
}

const tone = (n: number | null) =>
  n == null ? "text-slate-400" : n >= 0 ? "text-emerald-600" : "text-rose-600";

/** Días naturales hasta el tercer viernes del mes de venc (convención BMV/MexDer). */
function daysToExpiry(vencMes?: ExpirationMonth, vencAnio?: number): number {
  if (!vencMes || !vencAnio) return 0;
  const expiry = quarterlyExpiryDate(vencMes, vencAnio);
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Diferencia exacta entre fechas (sin extender expiry al fin del día).
  // round protege contra el desfase de 1h por horario de verano.
  return Math.max(0, Math.round((expiry.getTime() - today.getTime()) / 86_400_000));
}

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function BSMTab({ positions }: Props) {
  // r global, default 10% (almacenado como string para tolerar input vacío)
  const [rStr, setRStr] = useState<string>("10.00");

  // q por ticker (input en % como string)
  const [qStr, setQStr] = useState<Record<string, string>>({});

  // spot y vol por fila (key = opcionKey)
  const [inputs, setInputs] = useState<Record<string, { spot: string; vol: string }>>({});

  // Hidratamos desde localStorage al montar. Marcamos hydrated=true para no
  // sobrescribir en el primer render con los defaults.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = loadStored();
    if (typeof s.r === "string") setRStr(s.r);
    if (s.q && typeof s.q === "object") setQStr(s.q);
    if (s.inputs && typeof s.inputs === "object") setInputs(s.inputs);
    setHydrated(true);
  }, []);

  // Persistir cada cambio (después de hydrate)
  useEffect(() => {
    if (!hydrated) return;
    saveStored({ r: rStr, q: qStr, inputs });
  }, [hydrated, rStr, qStr, inputs]);

  // Opciones vivas, agrupadas
  const liveOptions = useMemo<InstrumentGroup[]>(() => {
    const onlyOptions = positions.filter((p) => p.tipo === "call" || p.tipo === "put");
    return filterLiveGroups(groupPositions(onlyOptions, opcionKey)).sort((a, b) => {
      if (a.ticker !== b.ticker) return a.ticker.localeCompare(b.ticker);
      const aV = `${a.vencAnio ?? ""}-${a.vencMes ?? ""}`;
      const bV = `${b.vencAnio ?? ""}-${b.vencMes ?? ""}`;
      if (aV !== bV) return aV.localeCompare(bV);
      if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
      return (a.strike ?? 0) - (b.strike ?? 0);
    });
  }, [positions]);

  // Tickers únicos para el panel de q
  const tickers = useMemo(
    () => Array.from(new Set(liveOptions.map((g) => g.ticker))).sort(),
    [liveOptions],
  );

  const r = (parseNum(rStr) ?? 0) / 100;

  const updateInput = (key: string, field: "spot" | "vol", value: string) =>
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], spot: prev[key]?.spot ?? "", vol: prev[key]?.vol ?? "", [field]: value } }));

  if (liveOptions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-sm">
        No hay opciones vivas en la cartera.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Panel de inputs globales / por ticker */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm grid gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Tasa libre de riesgo (r):
          </label>
          <div className="inline-flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              value={rStr}
              onChange={(e) => setRStr(e.target.value)}
              className="w-20 bg-white border border-slate-300 rounded px-2 py-1 text-sm text-right font-mono focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex"
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
        </div>

        <div className="flex items-start gap-3 flex-wrap">
          <label className="text-xs uppercase tracking-wider text-slate-500 pt-1.5">
            Dividend yield (q) por ticker:
          </label>
          <div className="flex flex-wrap gap-2">
            {tickers.map((t) => (
              <div key={t} className="inline-flex items-center gap-1 text-xs">
                <span className="font-mono text-slate-700">{t}</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={qStr[t] ?? ""}
                  onChange={(e) => setQStr((prev) => ({ ...prev, [t]: e.target.value }))}
                  className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex"
                />
                <span className="text-slate-500">%</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          T se calcula al 3er viernes del mes de vencimiento (convención BMV/MexDer), en días naturales / 365.
          Griegas raw: ν por 1.0 (=100%) de cambio en σ, Θ por año, ρ por 1.0 de cambio en r, ψ por 1.0 de cambio en q.
        </p>
      </div>

      {/* Tabla principal */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="text-left px-2 py-2">Ticker</th>
              <th className="text-left px-2 py-2">Tipo</th>
              <th className="text-right px-2 py-2">Strike</th>
              <th className="text-left px-2 py-2">Venc.</th>
              <th className="text-right px-2 py-2">Neto</th>
              <th className="text-right px-2 py-2 bg-amber-50">Spot</th>
              <th className="text-right px-2 py-2 bg-amber-50">Vol %</th>
              <th className="text-right px-2 py-2">T (d)</th>
              <th className="text-right px-2 py-2">Prima</th>
              <th className="text-right px-2 py-2">Δ %</th>
              <th className="text-right px-2 py-2">Δ acc</th>
              <th className="text-right px-2 py-2">Γ</th>
              <th className="text-right px-2 py-2" title="Vega — per 1.0 (=100%) absoluto de cambio en σ">ν</th>
              <th className="text-right px-2 py-2" title="Theta — per año">Θ</th>
              <th className="text-right px-2 py-2" title="Rho — per 1.0 de cambio en r">ρ</th>
              <th className="text-right px-2 py-2" title="Psi — per 1.0 de cambio en q (dividend yield)">ψ</th>
            </tr>
          </thead>
          <tbody>
            {liveOptions.map((g) => (
              <OptionRow
                key={g.key}
                option={g}
                rDecimal={r}
                qPct={qStr[g.ticker] ?? ""}
                spotStr={inputs[g.key]?.spot ?? ""}
                volStr={inputs[g.key]?.vol ?? ""}
                onSpotChange={(v) => updateInput(g.key, "spot", v)}
                onVolChange={(v) => updateInput(g.key, "vol", v)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Fila — la lógica BSM vive aquí
// ============================================================

function OptionRow({
  option,
  rDecimal,
  qPct,
  spotStr,
  volStr,
  onSpotChange,
  onVolChange,
}: {
  option: InstrumentGroup;
  rDecimal: number;
  qPct: string;
  spotStr: string;
  volStr: string;
  onSpotChange: (v: string) => void;
  onVolChange: (v: string) => void;
}) {
  const days = daysToExpiry(option.vencMes, option.vencAnio);
  const T = days / 365;
  const spot = parseNum(spotStr);
  const volPct = parseNum(volStr);
  const vol = volPct != null ? volPct / 100 : null;
  const q = (parseNum(qPct) ?? 0) / 100;

  const isCall = option.tipo === "call";

  const result = useMemo(() => {
    if (spot == null || vol == null || option.strike == null) return null;
    return bsm({
      spot,
      strike: option.strike,
      T,
      r: rDecimal,
      q,
      vol,
      isCall,
    });
  }, [spot, vol, option.strike, T, rDecimal, q, isCall]);

  const venc = formatVencimiento({
    ticker: option.ticker,
    tipo: option.tipo,
    vencMes: option.vencMes,
    vencAnio: option.vencAnio,
  } as Position);

  const deltaPct = result != null ? result.delta * 100 : null;
  const deltaAcc = result != null ? result.delta * CONTRACT_SIZE : null;

  return (
    <tr className="border-t border-slate-200 hover:bg-slate-50/40">
      <td className="px-2 py-1.5 font-mono text-slate-900">{option.ticker}</td>
      <td className="px-2 py-1.5">
        <span
          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
            isCall ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {option.tipo}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-slate-700">
        {option.strike != null ? formatMoney(option.strike) : "—"}
      </td>
      <td className="px-2 py-1.5 font-mono text-slate-700">{venc ?? "—"}</td>
      <td className={`px-2 py-1.5 text-right font-mono ${option.netQty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
        {option.netQty >= 0 ? "+" : ""}{formatNumber(option.netQty)}
      </td>
      <td className="px-1 py-1 bg-amber-50/40 text-right">
        <input
          type="number"
          step="any"
          value={spotStr}
          onChange={(e) => onSpotChange(e.target.value)}
          placeholder="—"
          className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex"
        />
      </td>
      <td className="px-1 py-1 bg-amber-50/40 text-right">
        <input
          type="number"
          step="any"
          value={volStr}
          onChange={(e) => onVolChange(e.target.value)}
          placeholder="—"
          className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex"
        />
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-slate-700">{days}</td>
      <td className="px-2 py-1.5 text-right font-mono text-slate-900">
        {result ? formatMoney(result.price) : <span className="text-slate-400">—</span>}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono ${tone(deltaPct)}`}>
        {deltaPct != null ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}%` : "—"}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono ${tone(deltaAcc)}`}>
        {deltaAcc != null ? `${deltaAcc >= 0 ? "+" : ""}${deltaAcc.toFixed(2)}` : "—"}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-slate-700">
        {result ? result.gamma.toFixed(4) : "—"}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-slate-700">
        {result ? result.vega.toFixed(4) : "—"}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono ${tone(result?.theta ?? null)}`}>
        {result ? result.theta.toFixed(4) : "—"}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono ${tone(result?.rho ?? null)}`}>
        {result ? result.rho.toFixed(4) : "—"}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono ${tone(result?.psi ?? null)}`}>
        {result ? result.psi.toFixed(4) : "—"}
      </td>
    </tr>
  );
}
