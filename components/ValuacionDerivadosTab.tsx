"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { bsm, bsmCashOrNothing, bsmAssetOrNothing, futurePrice } from "@/lib/bsm";

/**
 * Pestaña "Valuación derivados": tres calculadoras libres apiladas.
 *
 *   1. Vanilla (call y put) — BSM-Merton, solo prima.
 *   2. Digitales (cash-or-nothing y asset-or-nothing, call y put).
 *   3. Futuros — precio teórico continuo y discreto base 360.
 *
 * Cada sección es independiente (su propio state) para que puedas
 * comparar escenarios distintos sin que las inputs se peguen entre sí.
 */

export default function ValuacionDerivadosTab() {
  return (
    <div className="grid gap-6">
      <VanillaSection />
      <DigitalSection />
      <FuturoSection />
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

const today = () => new Date().toISOString().slice(0, 10);

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00");
  const to = new Date(toISO + "T00:00:00");
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const inputBase =
  "bg-white border border-slate-300 rounded px-2 py-1 text-sm text-right font-mono focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex";
const labelBase = "text-[11px] uppercase tracking-wider text-slate-500";
const cardBase = "bg-white border border-slate-200 rounded-lg p-5 shadow-sm";

// ============================================================
// 1. Vanilla
// ============================================================

function VanillaSection() {
  const [vencFecha, setVencFecha] = useState<string>("");
  const [spot, setSpot] = useState<string>("");
  const [strike, setStrike] = useState<string>("");
  const [vol, setVol] = useState<string>("");
  const [r, setR] = useState<string>("10.00");
  const [q, setQ] = useState<string>("0.00");

  const days = vencFecha ? Math.max(0, daysBetween(today(), vencFecha)) : 0;
  const T = days / 365;

  const result = useMemo(() => {
    const S = parseNum(spot);
    const K = parseNum(strike);
    const sigmaPct = parseNum(vol);
    const rPct = parseNum(r);
    const qPct = parseNum(q);
    if (S == null || K == null || sigmaPct == null || rPct == null || qPct == null || T <= 0) {
      return null;
    }
    return {
      call: bsm({ spot: S, strike: K, T, r: rPct / 100, q: qPct / 100, vol: sigmaPct / 100, isCall: true }),
      put:  bsm({ spot: S, strike: K, T, r: rPct / 100, q: qPct / 100, vol: sigmaPct / 100, isCall: false }),
    };
  }, [spot, strike, vol, r, q, T]);

  return (
    <section className={cardBase}>
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        Vanilla — Black-Scholes-Merton
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Field label="Vencimiento">
          <input type="date" value={vencFecha} onChange={(e) => setVencFecha(e.target.value)} className={`${inputBase} text-left`} />
        </Field>
        <Field label="Spot S">
          <input type="number" step="any" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="0.00" className={inputBase} />
        </Field>
        <Field label="Strike K">
          <input type="number" step="any" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="0.00" className={inputBase} />
        </Field>
        <Field label="Vol σ (%)">
          <input type="number" step="any" value={vol} onChange={(e) => setVol(e.target.value)} placeholder="0.00" className={inputBase} />
        </Field>
        <Field label="Tasa r (%)">
          <input type="number" step="any" value={r} onChange={(e) => setR(e.target.value)} className={inputBase} />
        </Field>
        <Field label="Div q (%)">
          <input type="number" step="any" value={q} onChange={(e) => setQ(e.target.value)} className={inputBase} />
        </Field>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        T = {days} días = {(T || 0).toFixed(4)} años · griegas raw:
        ν por 1.0 (=100%) de σ, Θ por año, ρ por 1.0 de r, ψ por 1.0 de q.
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left px-3 py-2"></th>
              <th className="text-right px-3 py-2">Call</th>
              <th className="text-right px-3 py-2">Put</th>
            </tr>
          </thead>
          <tbody>
            <VanillaGreekRow label="Prima" valC={result?.call?.price} valP={result?.put?.price} kind="money" />
            <VanillaGreekRow label="Δ"     valC={result?.call?.delta} valP={result?.put?.delta} kind="signed" />
            <VanillaGreekRow label="Γ"     valC={result?.call?.gamma} valP={result?.put?.gamma} kind="number" />
            <VanillaGreekRow label="ν"     valC={result?.call?.vega}  valP={result?.put?.vega}  kind="number" />
            <VanillaGreekRow label="Θ"     valC={result?.call?.theta} valP={result?.put?.theta} kind="signed" />
            <VanillaGreekRow label="ρ"     valC={result?.call?.rho}   valP={result?.put?.rho}   kind="signed" />
            <VanillaGreekRow label="ψ"     valC={result?.call?.psi}   valP={result?.put?.psi}   kind="signed" />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VanillaGreekRow({
  label,
  valC,
  valP,
  kind,
}: {
  label: string;
  valC: number | null | undefined;
  valP: number | null | undefined;
  kind: "money" | "number" | "signed";
}) {
  const fmt = (v: number | null | undefined) => {
    if (v == null) return "—";
    if (kind === "money") return formatMoney(v);
    return v.toFixed(4);
  };
  const tone = (v: number | null | undefined) =>
    kind === "signed" && v != null
      ? v >= 0 ? "text-emerald-700" : "text-rose-700"
      : "text-slate-900";
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-1.5 text-slate-700">{label}</td>
      <td className={`px-3 py-1.5 text-right font-mono ${tone(valC)}`}>{fmt(valC)}</td>
      <td className={`px-3 py-1.5 text-right font-mono ${tone(valP)}`}>{fmt(valP)}</td>
    </tr>
  );
}

// ============================================================
// 2. Digital
// ============================================================

function DigitalSection() {
  const [vencFecha, setVencFecha] = useState<string>("");
  const [spot, setSpot] = useState<string>("");
  const [strike, setStrike] = useState<string>("");
  const [vol, setVol] = useState<string>("");
  const [r, setR] = useState<string>("10.00");
  const [q, setQ] = useState<string>("0.00");
  const [payout, setPayout] = useState<string>("1.00");

  const days = vencFecha ? Math.max(0, daysBetween(today(), vencFecha)) : 0;
  const T = days / 365;

  const result = useMemo(() => {
    const S = parseNum(spot);
    const K = parseNum(strike);
    const sigmaPct = parseNum(vol);
    const rPct = parseNum(r);
    const qPct = parseNum(q);
    const Q = parseNum(payout);
    if (S == null || K == null || sigmaPct == null || rPct == null || qPct == null || Q == null || T <= 0) {
      return null;
    }
    const base = { spot: S, strike: K, T, r: rPct / 100, q: qPct / 100, vol: sigmaPct / 100 };
    return {
      conCall: bsmCashOrNothing({ ...base, isCall: true }, Q),
      conPut:  bsmCashOrNothing({ ...base, isCall: false }, Q),
      aonCall: bsmAssetOrNothing({ ...base, isCall: true }),
      aonPut:  bsmAssetOrNothing({ ...base, isCall: false }),
    };
  }, [spot, strike, vol, r, q, payout, T]);

  return (
    <section className={cardBase}>
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        Digital — Cash-or-nothing y Asset-or-nothing
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <Field label="Vencimiento">
          <input type="date" value={vencFecha} onChange={(e) => setVencFecha(e.target.value)} className={`${inputBase} text-left`} />
        </Field>
        <Field label="Spot S">
          <input type="number" step="any" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="0.00" className={inputBase} />
        </Field>
        <Field label="Strike K">
          <input type="number" step="any" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="0.00" className={inputBase} />
        </Field>
        <Field label="Vol σ (%)">
          <input type="number" step="any" value={vol} onChange={(e) => setVol(e.target.value)} placeholder="0.00" className={inputBase} />
        </Field>
        <Field label="Tasa r (%)">
          <input type="number" step="any" value={r} onChange={(e) => setR(e.target.value)} className={inputBase} />
        </Field>
        <Field label="Div q (%)">
          <input type="number" step="any" value={q} onChange={(e) => setQ(e.target.value)} className={inputBase} />
        </Field>
        <Field label="Payout Q">
          <input type="number" step="any" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="1.00" className={inputBase} />
        </Field>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        T = {days} días = {(T || 0).toFixed(4)} años · Payout Q sólo aplica a cash-or-nothing.
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left px-3 py-2"></th>
              <th className="text-right px-3 py-2">Call</th>
              <th className="text-right px-3 py-2">Put</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200">
              <td className="px-3 py-2 text-slate-700">Cash-or-nothing</td>
              <td className="px-3 py-2 text-right font-mono text-emerald-700">
                {result?.conCall != null ? formatMoney(result.conCall) : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-rose-700">
                {result?.conPut != null ? formatMoney(result.conPut) : "—"}
              </td>
            </tr>
            <tr className="border-t border-slate-200">
              <td className="px-3 py-2 text-slate-700">Asset-or-nothing</td>
              <td className="px-3 py-2 text-right font-mono text-emerald-700">
                {result?.aonCall != null ? formatMoney(result.aonCall) : "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-rose-700">
                {result?.aonPut != null ? formatMoney(result.aonPut) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// 3. Futuro
// ============================================================

function FuturoSection() {
  const [vencFecha, setVencFecha] = useState<string>("");
  const [spot, setSpot] = useState<string>("");
  const [r, setR] = useState<string>("10.00");
  const [q, setQ] = useState<string>("0.00");

  const days = vencFecha ? Math.max(0, daysBetween(today(), vencFecha)) : 0;
  const T = days / 365;

  const result = useMemo(() => {
    const S = parseNum(spot);
    const rPct = parseNum(r);
    const qPct = parseNum(q);
    if (S == null || rPct == null || qPct == null || days < 0) return null;
    return futurePrice(S, days, rPct / 100, qPct / 100);
  }, [spot, r, q, days]);

  return (
    <section className={cardBase}>
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        Futuros — precio teórico
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Vencimiento">
          <input type="date" value={vencFecha} onChange={(e) => setVencFecha(e.target.value)} className={`${inputBase} text-left`} />
        </Field>
        <Field label="Spot S">
          <input type="number" step="any" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="0.00" className={inputBase} />
        </Field>
        <Field label="Tasa r (%)">
          <input type="number" step="any" value={r} onChange={(e) => setR(e.target.value)} className={inputBase} />
        </Field>
        <Field label="Div q (%)">
          <input type="number" step="any" value={q} onChange={(e) => setQ(e.target.value)} className={inputBase} />
        </Field>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        T = {days} días · continuo usa días/365 · discreto usa días/360 (interés simple)
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <OutputCard
          label="F continuo  ·  S × e^((r−q)·T)"
          value={result ? formatMoney(result.continuous) : "—"}
          tone="neutral"
        />
        <OutputCard
          label="F discreto base 360  ·  S × (1 + (r−q)·días/360)"
          value={result ? formatMoney(result.discrete360) : "—"}
          tone="neutral"
        />
      </div>
    </section>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelBase}>{label}</label>
      {children}
    </div>
  );
}

function OutputCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "pos" | "neg" | "neutral";
}) {
  const colorClass =
    tone === "pos" ? "text-emerald-700"
    : tone === "neg" ? "text-rose-700"
    : "text-slate-900";
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xl font-mono mt-1 ${colorClass}`}>{value}</div>
    </div>
  );
}
