export type InstrumentType = "equity" | "call" | "put" | "futuro" | "forward";

export type ExpirationMonth = "MAR" | "JUN" | "SEP" | "DIC";
export const EXPIRATION_MONTHS: ExpirationMonth[] = ["MAR", "JUN", "SEP", "DIC"];

export interface Position {
  id: string;
  fecha: string;          // ISO date yyyy-mm-dd
  tipo: InstrumentType;
  ticker: string;         // emisora o subyacente
  posicion: number;       // + largo, - corto (títulos o contratos)
  precio: number;         // precio / prima unitaria por acción
  strike?: number;        // precio de ejercicio (solo para call / put)
  vencMes?: ExpirationMonth; // ciclo trimestral (solo opciones por ahora)
  vencAnio?: number;      // año de vencimiento, e.g. 2026
}

export const isOption = (t: InstrumentType): boolean => t === "call" || t === "put";

// Multiplicador de contrato: cada contrato de derivado (futuro, call, put)
// equivale a 100 acciones del subyacente.
export const CONTRACT_MULTIPLIER: Record<InstrumentType, number> = {
  equity: 1,
  call: 100,
  put: 100,
  futuro: 100,
  forward: 1,
};

// Nocional derivado = precio × posición × multiplicador, con el signo
// de la posición (largo + / corto -).
export const notional = (p: Position): number =>
  p.precio * p.posicion * CONTRACT_MULTIPLIER[p.tipo];

export const formatVencimiento = (p: Position): string | null =>
  p.vencMes && p.vencAnio ? `${p.vencMes}${String(p.vencAnio).slice(-2)}` : null;

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  equity: "Equity",
  call: "Call",
  put: "Put",
  futuro: "Futuro",
  forward: "Forward",
};

export const INSTRUMENT_OPTIONS: InstrumentType[] = [
  "equity",
  "call",
  "put",
  "futuro",
  "forward",
];
