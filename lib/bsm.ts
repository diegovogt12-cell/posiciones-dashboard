/**
 * Black-Scholes-Merton para opciones europeas sobre acción con dividend
 * yield continuo q.
 *
 *   d1 = ( ln(S/K) + (r - q + σ²/2) T ) / ( σ √T )
 *   d2 = d1 - σ √T
 *
 * Call: C = S e^(-qT) N(d1) - K e^(-rT) N(d2)
 * Put:  P = K e^(-rT) N(-d2) - S e^(-qT) N(-d1)
 *
 * Greeks (convención trader: vega y rho por 1% absoluto, no por 1.0):
 *
 *   Δ_call =  e^(-qT) N(d1)
 *   Δ_put  = -e^(-qT) N(-d1)
 *   Γ      =  e^(-qT) φ(d1) / (S σ √T)
 *   ν      =  S e^(-qT) φ(d1) √T   / 100
 *   ρ_call =  K T e^(-rT) N(d2)    / 100
 *   ρ_put  = -K T e^(-rT) N(-d2)   / 100
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
  delta: number;    // raw (e.g., 0.55 para call ATM)
  gamma: number;
  vega: number;     // por 1% absoluto de cambio en vol
  rho: number;      // por 1% absoluto de cambio en r
}

/**
 * Devuelve null si algún input es inválido (T<=0, vol<=0, spot<=0, strike<=0).
 */
export function bsm(inputs: BSMInputs): BSMOutputs | null {
  const { spot, strike, T, r, q, vol, isCall } = inputs;
  if (!(spot > 0) || !(strike > 0) || !(T > 0) || !(vol > 0)) return null;
  if (!Number.isFinite(r) || !Number.isFinite(q)) return null;

  const sigmaSqrtT = vol * Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r - q + 0.5 * vol * vol) * T) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;
  const eMinusQT = Math.exp(-q * T);
  const eMinusRT = Math.exp(-r * T);
  const phiD1 = normPDF(d1);

  let price: number;
  let delta: number;
  let rho: number;

  if (isCall) {
    price = spot * eMinusQT * normCDF(d1) - strike * eMinusRT * normCDF(d2);
    delta = eMinusQT * normCDF(d1);
    rho   = strike * T * eMinusRT * normCDF(d2);
  } else {
    price = strike * eMinusRT * normCDF(-d2) - spot * eMinusQT * normCDF(-d1);
    delta = -eMinusQT * normCDF(-d1);
    rho   = -strike * T * eMinusRT * normCDF(-d2);
  }

  const gamma = (eMinusQT * phiD1) / (spot * sigmaSqrtT);
  const vega  = spot * eMinusQT * phiD1 * Math.sqrt(T);

  return {
    price,
    delta,
    gamma,
    vega: vega / 100,  // por 1%
    rho:  rho  / 100,  // por 1%
  };
}
