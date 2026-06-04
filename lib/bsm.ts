/**
 * Black-Scholes-Merton para opciones europeas sobre acción con dividend
 * yield continuo q (= δ en la notación del cliente).
 *
 *   d1 = ( ln(S/K) + (r − q + σ²/2) T ) / ( σ √T )
 *   d2 = d1 − σ √T
 *
 * Call: C = S e^(-qT) N(d1) − K e^(-rT) N(d2)
 * Put:  P = K e^(-rT) N(-d2) − S e^(-qT) N(-d1)
 *
 * Griegas (valores raw — sin dividir entre 100):
 *
 *   Δ_call =  e^(-qT) N(d1)
 *   Δ_put  =  e^(-qT) N(d1) − e^(-qT)   [equivalente a −e^(-qT) N(-d1)]
 *   Γ      =  e^(-qT) φ(d1) / (S σ √T)
 *   ν      =  S e^(-qT) φ(d1) √T                                       (per 1.0 de σ)
 *   Θ_call =  q S e^(-qT) N(d1) − r K e^(-rT) N(d2) − K e^(-rT) φ(d2) σ / (2√T)
 *   Θ_put  =  Θ_call + r K e^(-rT) − q S e^(-qT)                       (per año)
 *   ρ_call =  T K e^(-rT) N(d2)                                        (per 1.0 de r)
 *   ρ_put  =  ρ_call − T K e^(-rT)
 *   ψ_call = −T S e^(-qT) N(d1)                                        (per 1.0 de q)
 *   ψ_put  =  ψ_call + T S e^(-qT)
 *
 * Identidad usada en Θ_call: S e^(-qT) φ(d1) = K e^(-rT) φ(d2).
 */

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, max error ~1.5e-7). */
function normCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  const erf = sign * y;
  return 0.5 * (1 + erf);
}

/** Standard normal PDF. */
function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface BSMInputs {
  spot: number;     // S, precio del subyacente, > 0
  strike: number;   // K, precio de ejercicio, > 0
  T: number;        // años al vencimiento, > 0
  r: number;        // tasa libre de riesgo continua (decimal: 0.10 = 10%)
  q: number;        // dividend yield continuo (decimal: 0.02 = 2%)
  vol: number;      // volatilidad anualizada (decimal: 0.30 = 30%)
  isCall: boolean;
}

export interface BSMOutputs {
  price: number;
  delta: number;    // raw (ej. 0.55 para call ATM)
  gamma: number;    // raw
  vega: number;     // raw — por 1.0 (=100%) de cambio en σ
  theta: number;    // raw — por año
  rho: number;      // raw — por 1.0 de cambio en r
  psi: number;      // raw — por 1.0 de cambio en q (δ)
}

/**
 * Devuelve null si algún input es inválido (T<=0, vol<=0, spot<=0, strike<=0).
 *
 * Todas las griegas son raw (sin dividir entre 100). Para escala "por 1%"
 * el consumidor divide vega, rho, psi entre 100 según su convención.
 */
export function bsm(inputs: BSMInputs): BSMOutputs | null {
  const { spot, strike, T, r, q, vol, isCall } = inputs;
  if (!(spot > 0) || !(strike > 0) || !(T > 0) || !(vol > 0)) return null;
  if (!Number.isFinite(r) || !Number.isFinite(q)) return null;

  const sqrtT = Math.sqrt(T);
  const sigmaSqrtT = vol * sqrtT;
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * vol * vol) * T) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;
  const eMinusQT = Math.exp(-q * T);
  const eMinusRT = Math.exp(-r * T);
  const phiD1 = normPDF(d1);
  const phiD2 = normPDF(d2);

  // Greeks comunes (mismas en call y put)
  const gamma = (eMinusQT * phiD1) / (spot * sigmaSqrtT);
  const vega  = spot * eMinusQT * phiD1 * sqrtT;

  // Θ_call (compartido para derivar Θ_put)
  const thetaCall =
      q * spot * eMinusQT * normCDF(d1)
    - r * strike * eMinusRT * normCDF(d2)
    - (strike * eMinusRT * phiD2 * vol) / (2 * sqrtT);

  let price: number, delta: number, theta: number, rho: number, psi: number;

  if (isCall) {
    price = spot * eMinusQT * normCDF(d1) - strike * eMinusRT * normCDF(d2);
    delta = eMinusQT * normCDF(d1);
    theta = thetaCall;
    rho   =  strike * T * eMinusRT * normCDF(d2);
    psi   = -spot * T * eMinusQT * normCDF(d1);
  } else {
    price = strike * eMinusRT * normCDF(-d2) - spot * eMinusQT * normCDF(-d1);
    // Δ_put = e^(-qT) N(d1) − e^(-qT)
    delta = eMinusQT * (normCDF(d1) - 1);
    // Θ_put = Θ_call + r K e^(-rT) − q S e^(-qT)
    theta = thetaCall + r * strike * eMinusRT - q * spot * eMinusQT;
    // ρ_put = ρ_call − T K e^(-rT)
    rho   = strike * T * eMinusRT * normCDF(d2) - strike * T * eMinusRT;
    // ψ_put = ψ_call + T S e^(-qT)
    psi   = -spot * T * eMinusQT * normCDF(d1) + spot * T * eMinusQT;
  }

  return { price, delta, gamma, vega, theta, rho, psi };
}

// ============================================================
// Helpers para acceder a CDF/PDF normales desde otros módulos
// (las uso para digitales — exportarlas evita duplicar el polinomio).
// ============================================================
export const _normCDF = normCDF;
export const _normPDF = normPDF;

// ============================================================
// Opciones digitales (cash-or-nothing y asset-or-nothing)
// ============================================================

/**
 * Inputs base para opciones digitales: subset de BSMInputs sin payout
 * (el payout sólo aplica a cash-or-nothing).
 */
export interface DigitalInputs {
  spot: number;
  strike: number;
  T: number;
  r: number;
  q: number;
  vol: number;
  isCall: boolean;
}

/**
 * Cash-or-nothing: paga `payout` si vence ITM, 0 si no.
 *   Call: Q × e^(-rT) × N(d2)
 *   Put:  Q × e^(-rT) × N(-d2)
 */
export function bsmCashOrNothing(inputs: DigitalInputs, payout: number): number | null {
  const { spot, strike, T, r, q, vol, isCall } = inputs;
  if (!(spot > 0) || !(strike > 0) || !(T > 0) || !(vol > 0) || !(payout > 0)) return null;

  const sigmaSqrtT = vol * Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * vol * vol) * T) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;
  const discount = Math.exp(-r * T);

  return payout * discount * (isCall ? normCDF(d2) : normCDF(-d2));
}

/**
 * Asset-or-nothing: paga S_T si vence ITM, 0 si no.
 *   Call: S × e^(-qT) × N(d1)
 *   Put:  S × e^(-qT) × N(-d1)
 */
export function bsmAssetOrNothing(inputs: DigitalInputs): number | null {
  const { spot, strike, T, r, q, vol, isCall } = inputs;
  if (!(spot > 0) || !(strike > 0) || !(T > 0) || !(vol > 0)) return null;

  const sigmaSqrtT = vol * Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * vol * vol) * T) / sigmaSqrtT;
  const eMinusQT = Math.exp(-q * T);

  return spot * eMinusQT * (isCall ? normCDF(d1) : normCDF(-d1));
}

// ============================================================
// Precio teórico de futuros (carry)
// ============================================================

export interface FuturePriceResult {
  /** F = S × e^((r − q) × T) con T = días/365 */
  continuous: number;
  /** F = S × (1 + (r − q) × días/360) — interés simple base 360 */
  discrete360: number;
}

export function futurePrice(spot: number, days: number, r: number, q: number): FuturePriceResult | null {
  if (!(spot > 0) || days < 0) return null;
  if (!Number.isFinite(r) || !Number.isFinite(q)) return null;
  const T = days / 365;
  const continuous = spot * Math.exp((r - q) * T);
  const discrete360 = spot * (1 + (r - q) * (days / 360));
  return { continuous, discrete360 };
}
