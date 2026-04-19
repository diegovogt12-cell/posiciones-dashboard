export type InstrumentType = "equity" | "call" | "put" | "futuro" | "forward";

export type ExpirationMonth = "MAR" | "JUN" | "SEP" | "DIC";
export const EXPIRATION_MONTHS: ExpirationMonth[] = ["MAR", "JUN", "SEP", "DIC"];

export interface Position {
  id: string;
  fecha: string;          // ISO date yyyy-mm-dd — fecha de captura
  tipo: InstrumentType;
  ticker: string;         // emisora o subyacente
  posicion: number;       // + largo, - corto (títulos o contratos)
  precio: number;         // precio / prima unitaria por acción
  strike?: number;        // precio de ejercicio (solo para call / put)
  // Vencimiento trimestral (futuros y opciones listadas)
  vencMes?: ExpirationMonth;
  vencAnio?: number;
  // Vencimiento libre (forwards OTC)
  vencFecha?: string;     // ISO yyyy-mm-dd
}

export const isOption = (t: InstrumentType): boolean => t === "call" || t === "put";

export const hasQuarterlyExpiry = (t: InstrumentType): boolean =>
  t === "call" || t === "put" || t === "futuro";

export const hasCustomExpiry = (t: InstrumentType): boolean => t === "forward";

// Multiplicador de contrato: cada contrato de derivado (futuro, call, put)
// equivale a 100 acciones del subyacente.
export const CONTRACT_MULTIPLIER: Record<InstrumentType, number> = {
  equity: 1,
  call: 100,
  put: 100,
  futuro: 100,
  forward: 1,
};

// Nocional de prima/precio: flujo de caja de la posición.
// = precio × posición × multiplicador, preserva signo (largo + / corto -).
export const notional = (p: Position): number =>
  p.precio * p.posicion * CONTRACT_MULTIPLIER[p.tipo];

// Nocional de exposición al subyacente: strike × posición × multiplicador.
// Solo aplica a opciones con strike capturado.
export const notionalExposure = (p: Position): number | null => {
  if (!isOption(p.tipo) || p.strike == null) return null;
  return p.strike * p.posicion * CONTRACT_MULTIPLIER[p.tipo];
};

export const formatVencimiento = (p: Position): string | null => {
  if (p.vencMes && p.vencAnio) return `${p.vencMes}${String(p.vencAnio).slice(-2)}`;
  if (p.vencFecha) return p.vencFecha;
  return null;
};

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
