import { OptionType, SimulationLeg, PayoffPoint } from '../types/options';

/* ============================================================================
 * CONVENÇÕES (B3)
 * - T em anos = dias úteis / 252
 * - r em taxa CONTÍNUA: r = ln(1 + DI efetivo anual)
 * - Theta por dia ÚTIL (anual / 252)
 * - Dividend yield contínuo q (modelo de Merton)
 * - Exercício americano via árvore CRR com variável de controle (Hull)
 * ========================================================================== */

export const BUSINESS_DAYS_PER_YEAR = 252;
export const CALENDAR_DAYS_PER_YEAR = 365;

/**
 * CDI/Selic efetiva ≈ 13,65% a.a. (Selic meta 13,75% a.a. após o Copom de 04/11/2026).
 * Atualize periodicamente ou, melhor, use createDiCurve() com a curva de futuros de DI.
 */
export const DEFAULT_DI_EFFECTIVE = 0.1365;

/** Converte taxa efetiva anual (DI) em taxa contínua: ln(1 + DI) */
export function effectiveToContinuous(effectiveRate: number): number {
  return Math.log(1 + effectiveRate);
}

/** Taxa livre de risco padrão em base CONTÍNUA (~12,79%) */
export const DEFAULT_RISK_FREE_RATE = effectiveToContinuous(DEFAULT_DI_EFFECTIVE);

export type ExerciseStyle = 'AMERICAN' | 'EUROPEAN';

/** Padrão para opções de ações na B3. Configure EUROPEAN por perna quando for o caso (ex.: opções de índice). */
export const DEFAULT_EXERCISE_STYLE: ExerciseStyle = 'AMERICAN';

/** Passos da árvore binomial para opções americanas */
export const AMERICAN_TREE_STEPS = 200;

const MIN_T = 0.0001;

/**
 * Perna com campos opcionais adicionais. Compatível com SimulationLeg existente.
 * - businessDaysToExpiration: dias úteis até o vencimento (use countBusinessDays). Se ausente,
 *   é estimado a partir de daysToExpiration (dias corridos) * 252/365.
 * - dividendYield: yield contínuo de proventos da ação (ex.: 0.06 = 6% a.a.)
 * - exerciseStyle: 'AMERICAN' | 'EUROPEAN'
 */
export type PricingLeg = SimulationLeg & {
  businessDaysToExpiration?: number;
  dividendYield?: number;
  exerciseStyle?: ExerciseStyle;
};

/* ============================================================================
 * CALENDÁRIO E CURVA DE JUROS
 * ========================================================================== */

/** Feriados B3 (dias sem pregão). CONFIRME no calendário oficial da B3 e complete conforme necessário. */
export const B3_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01',
  '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-20', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-01',
  '2027-05-27', '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20',
  '2027-12-25',
]);

function toIsoLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Conta dias úteis no intervalo (from, to] — convenção usada para DI/opções. */
export function countBusinessDays(
  from: Date,
  to: Date,
  holidays: ReadonlySet<string> = B3_HOLIDAYS
): number {
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  let count = 0;
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(toIsoLocal(cur))) count++;
  }
  return count;
}

/** Estimativa de dias úteis a partir de dias corridos (fallback). */
export function calendarToBusinessDays(calendarDays: number): number {
  return Math.round((calendarDays * BUSINESS_DAYS_PER_YEAR) / CALENDAR_DAYS_PER_YEAR);
}

/** Função que devolve a taxa CONTÍNUA para um prazo em dias úteis. */
export type RateCurve = (businessDays: number) => number;
/** number = taxa contínua fixa; função = curva por prazo. */
export type RateInput = number | RateCurve;

export interface DiNode {
  businessDays: number;
  /** Taxa DI efetiva anual (ex.: 0.1350) para o vértice (futuro de DI) */
  rate: number;
}

/**
 * Cria curva a partir dos vértices de DI futuro, com interpolação flat-forward
 * (linear no fator logarítmico), padrão do mercado brasileiro.
 */
export function createDiCurve(nodes: DiNode[]): RateCurve {
  if (nodes.length === 0) return () => DEFAULT_RISK_FREE_RATE;
  const sorted = [...nodes].sort((a, b) => a.businessDays - b.businessDays);
  const logFactor = (n: DiNode) => (n.businessDays / BUSINESS_DAYS_PER_YEAR) * Math.log(1 + n.rate);

  return (du: number) => {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (du <= first.businessDays) return Math.log(1 + first.rate);
    if (du >= last.businessDays) return Math.log(1 + last.rate);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (du >= a.businessDays && du <= b.businessDays) {
        const w = (du - a.businessDays) / (b.businessDays - a.businessDays);
        const L = logFactor(a) + (logFactor(b) - logFactor(a)) * w;
        return L / (du / BUSINESS_DAYS_PER_YEAR);
      }
    }
    return Math.log(1 + last.rate);
  };
}

function resolveRate(r: RateInput, businessDays: number): number {
  return typeof r === 'number' ? r : r(businessDays);
}

/* ============================================================================
 * DISTRIBUIÇÃO NORMAL
 * ========================================================================== */

/** Densidade da normal padrão */
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Normal acumulada com precisão de dupla (algoritmo de Hart/West, erro ~1e-15).
 * Substitui Abramowitz-Stegun (erro ~1e-7), importante para IV com tolerância apertada.
 */
export function normalCdf(x: number): number {
  const xabs = Math.abs(x);
  let c: number;

  if (xabs > 37) {
    c = 0;
  } else {
    const e = Math.exp((-xabs * xabs) / 2);
    if (xabs < 7.07106781186547) {
      let b = 3.52624965998911e-2 * xabs + 0.700383064443688;
      b = b * xabs + 6.37396220353165;
      b = b * xabs + 33.912866078383;
      b = b * xabs + 112.079291497871;
      b = b * xabs + 221.213596169931;
      b = b * xabs + 220.206867912376;
      c = e * b;
      b = 8.83883476483184e-2 * xabs + 1.75566716318264;
      b = b * xabs + 16.064177579207;
      b = b * xabs + 86.7807322029461;
      b = b * xabs + 296.564248779674;
      b = b * xabs + 637.333633378831;
      b = b * xabs + 793.826512519948;
      b = b * xabs + 440.413735824752;
      c = c / b;
    } else {
      let b = xabs + 0.65;
      b = xabs + 4 / b;
      b = xabs + 3 / b;
      b = xabs + 2 / b;
      b = xabs + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/* ============================================================================
 * PRECIFICAÇÃO
 * ========================================================================== */

export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // Theta por DIA ÚTIL (anual / 252), em R$
  vega: number;  // Vega por 1% de variação na volatilidade
  rho: number;   // Rho por 1% de variação na taxa de juros
}

export interface PricingParams {
  S: number;
  K: number;
  /** Tempo em anos = dias úteis / 252 */
  T: number;
  /** Taxa contínua */
  r: number;
  sigma: number;
  /** Dividend yield contínuo */
  q: number;
  type: OptionType;
  style: ExerciseStyle;
}

function intrinsicResult(S: number, K: number, type: OptionType): BSResult {
  const isCall = type === 'CALL';
  return {
    price: isCall ? Math.max(0, S - K) : Math.max(0, K - S),
    delta: isCall ? (S > K ? 1 : 0) : S < K ? -1 : 0,
    gamma: 0,
    theta: 0,
    vega: 0,
    rho: 0,
  };
}

/**
 * Black-Scholes-Merton (europeu) com dividend yield contínuo q.
 * S: spot | K: strike | T: anos (dias úteis/252) | r: taxa CONTÍNUA | sigma: vol | q: yield
 */
export function calculateBlackScholes(
  S: number,
  K: number,
  T: number,
  r: number = DEFAULT_RISK_FREE_RATE,
  sigma: number = 0.30,
  type: OptionType = 'CALL',
  q: number = 0
): BSResult {
  if (T <= MIN_T) return intrinsicResult(S, K, type);
  if (S <= 0.0001) {
    const isCall = type === 'CALL';
    const dfR = Math.exp(-r * T);
    return {
      price: isCall ? 0 : K * dfR,
      delta: isCall ? 0 : -1,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: isCall ? 0 : (-K * T * dfR) / 100,
    };
  }
  if (sigma <= 0.001) sigma = 0.001;

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const dfR = Math.exp(-r * T);
  const dfQ = Math.exp(-q * T);
  const pdfD1 = normalPdf(d1);

  let price: number;
  let delta: number;
  let thetaYearly: number;
  let rhoYearly: number;

  if (type === 'CALL') {
    const nd1 = normalCdf(d1);
    const nd2 = normalCdf(d2);
    price = S * dfQ * nd1 - K * dfR * nd2;
    delta = dfQ * nd1;
    thetaYearly = -(S * dfQ * pdfD1 * sigma) / (2 * sqrtT) - r * K * dfR * nd2 + q * S * dfQ * nd1;
    rhoYearly = K * T * dfR * nd2;
  } else {
    const nmd1 = normalCdf(-d1);
    const nmd2 = normalCdf(-d2);
    price = K * dfR * nmd2 - S * dfQ * nmd1;
    delta = -dfQ * nmd1;
    thetaYearly = -(S * dfQ * pdfD1 * sigma) / (2 * sqrtT) + r * K * dfR * nmd2 - q * S * dfQ * nmd1;
    rhoYearly = -K * T * dfR * nmd2;
  }

  return {
    price: Math.max(0, price),
    delta,
    gamma: (dfQ * pdfD1) / (S * sigma * sqrtT),
    theta: thetaYearly / BUSINESS_DAYS_PER_YEAR,
    vega: (S * dfQ * sqrtT * pdfD1) / 100,
    rho: rhoYearly / 100,
  };
}

interface TreeResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // por ano
}

/** Árvore binomial CRR (americana ou europeia) com yield q. Delta/gamma/theta lidos dos nós (Hull). */
function crrTree(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number,
  type: OptionType,
  steps: number,
  american: boolean
): TreeResult {
  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const disc = Math.exp(-r * dt);
  const p = Math.min(1, Math.max(0, (Math.exp((r - q) * dt) - d) / (u - d)));
  const isCall = type === 'CALL';
  const payoff = (s: number) => (isCall ? Math.max(0, s - K) : Math.max(0, K - s));

  // powU[k + steps] = u^k
  const powU = new Float64Array(2 * steps + 1);
  for (let k = -steps; k <= steps; k++) powU[k + steps] = Math.pow(u, k);

  const v = new Float64Array(steps + 1);
  for (let j = 0; j <= steps; j++) v[j] = payoff(S * powU[2 * j]);

  let f1u = 0, f1d = 0, f2u = 0, f2m = 0, f2d = 0;

  for (let i = steps - 1; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      let val = disc * (p * v[j + 1] + (1 - p) * v[j]);
      if (american) {
        const ex = payoff(S * powU[2 * j - i + steps]);
        if (ex > val) val = ex;
      }
      v[j] = val;
    }
    if (i === 2) { f2d = v[0]; f2m = v[1]; f2u = v[2]; }
    if (i === 1) { f1d = v[0]; f1u = v[1]; }
  }

  const price = v[0];
  const Su = S * u, Sd = S * d, Suu = S * u * u, Sdd = S * d * d;
  const delta = (f1u - f1d) / (Su - Sd);
  const gamma = ((f2u - f2m) / (Suu - S) - (f2m - f2d) / (S - Sdd)) / (0.5 * (Suu - Sdd));
  const theta = (f2m - price) / (2 * dt);

  return { price, delta, gamma, theta };
}

function needsTree(p: PricingParams): boolean {
  if (p.T <= MIN_T) return false;
  if (p.style === 'EUROPEAN') return false;
  // Call americana sem dividendos nunca é exercida antecipadamente => igual à europeia
  if (p.type === 'CALL' && p.q <= 0) return false;
  return true;
}

/** Preço (apenas) respeitando o estilo de exercício. Variável de controle: Am_tree + (BS - Eu_tree). */
function optionPriceOnly(p: PricingParams): number {
  const bs = calculateBlackScholes(p.S, p.K, p.T, p.r, p.sigma, p.type, p.q);
  if (!needsTree(p)) return bs.price;

  const sigma = Math.max(p.sigma, 0.001);
  const am = crrTree(p.S, p.K, p.T, p.r, sigma, p.q, p.type, AMERICAN_TREE_STEPS, true);
  const eu = crrTree(p.S, p.K, p.T, p.r, sigma, p.q, p.type, AMERICAN_TREE_STEPS, false);
  const intrinsic = p.type === 'CALL' ? Math.max(0, p.S - p.K) : Math.max(0, p.K - p.S);
  return Math.max(intrinsic, bs.price, bs.price + (am.price - eu.price));
}

/** Preço + Greeks respeitando o estilo de exercício (BS analítico ou árvore americana). */
export function priceOption(p: PricingParams): BSResult {
  const bs = calculateBlackScholes(p.S, p.K, p.T, p.r, p.sigma, p.type, p.q);
  if (!needsTree(p)) return bs;

  const sigma = Math.max(p.sigma, 0.001);
  const am = crrTree(p.S, p.K, p.T, p.r, sigma, p.q, p.type, AMERICAN_TREE_STEPS, true);
  const eu = crrTree(p.S, p.K, p.T, p.r, sigma, p.q, p.type, AMERICAN_TREE_STEPS, false);

  const intrinsic = p.type === 'CALL' ? Math.max(0, p.S - p.K) : Math.max(0, p.K - p.S);
  const price = Math.max(intrinsic, bs.price, bs.price + (am.price - eu.price));

  const rawDelta = bs.delta + (am.delta - eu.delta);
  const delta = p.type === 'CALL' ? Math.min(1, Math.max(0, rawDelta)) : Math.min(0, Math.max(-1, rawDelta));
  const gamma = Math.max(0, bs.gamma + (am.gamma - eu.gamma));
  const theta = bs.theta + (am.theta - eu.theta) / BUSINESS_DAYS_PER_YEAR;

  const vega = optionPriceOnly({ ...p, sigma: p.sigma + 0.01 }) - price;
  const rho = optionPriceOnly({ ...p, r: p.r + 0.01 }) - price;

  return { price, delta, gamma, theta, vega, rho };
}

/* ============================================================================
 * VOLATILIDADE IMPLÍCITA
 * ========================================================================== */

/**
 * IV por Newton (europeu) com salvaguarda de bisseção, ou bisseção pura (americano).
 * Retorna null quando não há IV válida (preço abaixo do mínimo/valor intrínseco ou acima do máximo).
 */
export function calculateImpliedVolatility(
  targetPrice: number,
  S: number,
  K: number,
  T: number,
  r: number = DEFAULT_RISK_FREE_RATE,
  type: OptionType = 'CALL',
  q: number = 0,
  style: ExerciseStyle = DEFAULT_EXERCISE_STYLE
): number | null {
  if (!(targetPrice > 0) || T <= MIN_T) return null;

  const TOL = 1e-6;
  const LO = 0.01;
  const HI = 5.0;
  const base: Omit<PricingParams, 'sigma'> = { S, K, T, r, q, type, style };
  const f = (sigma: number) => optionPriceOnly({ ...base, sigma });

  const pLo = f(LO);
  const pHi = f(HI);
  if (targetPrice <= pLo || targetPrice >= pHi) return null;

  let lo = LO;
  let hi = HI;
  let sigma = 0.35;
  const useNewton = !needsTree({ ...base, sigma });

  for (let i = 0; i < 100; i++) {
    const price = f(sigma);
    const diff = price - targetPrice;
    if (Math.abs(diff) < TOL) return sigma;

    if (diff > 0) hi = sigma; else lo = sigma;
    if (hi - lo < 1e-8) return (lo + hi) / 2;

    let next = (lo + hi) / 2;
    if (useNewton) {
      const vega = calculateBlackScholes(S, K, T, r, sigma, type, q).vega * 100;
      if (vega > 1e-8) {
        const cand = sigma - diff / vega;
        if (cand > lo && cand < hi) next = cand;
      }
    }
    sigma = next;
  }

  return sigma;
}

/* ============================================================================
 * AVALIAÇÃO DE PERNAS / ESTRUTURAS (suporta vencimentos distintos)
 * ========================================================================== */

function isOptionLeg(leg: PricingLeg): boolean {
  return !leg.isUnderlying && leg.type !== 'STOCK';
}

function legBusinessDays(leg: PricingLeg): number {
  if (leg.businessDaysToExpiration !== undefined) return leg.businessDaysToExpiration;
  return calendarToBusinessDays(leg.daysToExpiration);
}

function legParams(
  leg: PricingLeg,
  S: number,
  remainingBD: number,
  rInput: RateInput,
  sigma: number
): PricingParams {
  return {
    S,
    K: leg.strike,
    T: remainingBD / BUSINESS_DAYS_PER_YEAR,
    r: resolveRate(rInput, remainingBD),
    sigma,
    q: leg.dividendYield ?? 0,
    type: leg.type as OptionType,
    style: leg.exerciseStyle ?? DEFAULT_EXERCISE_STYLE,
  };
}

/** Preço + Greeks da perna com `remainingBD` dias úteis restantes (<=0 => valor intrínseco). */
function evaluateLeg(
  leg: PricingLeg,
  S: number,
  remainingBD: number,
  rInput: RateInput,
  volShock: number
): BSResult {
  if (remainingBD <= 0) return intrinsicResult(S, leg.strike, leg.type as OptionType);
  const sigma = Math.max(0.05, leg.iv + volShock);
  return priceOption(legParams(leg, S, remainingBD, rInput, sigma));
}

/** Apenas o valor da perna no horizonte (mais barato: sem Greeks). */
function legValueAt(leg: PricingLeg, S: number, remainingBD: number, rInput: RateInput): number {
  if (remainingBD <= 0) {
    return leg.type === 'CALL' ? Math.max(0, S - leg.strike) : Math.max(0, leg.strike - S);
  }
  const sigma = Math.max(0.05, leg.iv);
  return optionPriceOnly(legParams(leg, S, remainingBD, rInput, sigma));
}

/** Menor prazo (em dias úteis) entre as pernas de opção. 0 se não há opções. */
function nearestExpiryBD(legs: PricingLeg[]): number {
  const opts = legs.filter(isOptionLeg);
  if (opts.length === 0) return 0;
  return Math.min(...opts.map(legBusinessDays));
}

/**
 * P&L da estrutura no horizonte `horizonBD` (dias úteis a partir de hoje).
 * Pernas já vencidas valem o intrínseco; pernas ainda vivas são reprecificadas com o tempo restante
 * (essencial para calendar/diagonal spreads).
 */
function structurePnlAtHorizon(
  legs: PricingLeg[],
  S: number,
  rInput: RateInput,
  horizonBD: number
): number {
  let total = 0;
  for (const leg of legs) {
    const mult = leg.action === 'BUY' ? 1 : -1;
    if (!isOptionLeg(leg)) {
      total += mult * (S - leg.entryPrice) * leg.quantity;
      continue;
    }
    const value = legValueAt(leg, S, legBusinessDays(leg) - horizonBD, rInput);
    total += mult * (value - leg.entryPrice) * leg.quantity;
  }
  return total;
}

function priceBounds(legs: PricingLeg[], currentSpot: number): { low: number; high: number } {
  // Considera apenas strikes de opções (ações não têm strike)
  const strikes = legs.filter(isOptionLeg).map((l) => l.strike);
  const minStrike = Math.min(...strikes, currentSpot);
  const maxStrike = Math.max(...strikes, currentSpot);
  const buffer = Math.max((maxStrike - minStrike) * 0.45, currentSpot * 0.22);
  return { low: Math.max(0.5, minStrike - buffer), high: maxStrike + buffer };
}

/**
 * Curva de payoff da estrutura.
 *
 * @param evalDaysElapsed Dias ÚTEIS decorridos de hoje até a data de avaliação (0 = hoje).
 *   Cada perna usa (seu prazo - decorridos), então vencimentos diferentes são tratados corretamente.
 *   ATENÇÃO: antes era `evalDaysLeft` (dias restantes aplicados a todas as pernas).
 * @param volShock Choque aditivo na IV (ex.: +0.05) aplicado ao payoffToday.
 * @param r Taxa contínua fixa ou curva (createDiCurve).
 *
 * `payoffAtExpiry` = P&L no PRIMEIRO vencimento: pernas vencidas valem o intrínseco e
 * pernas mais longas são reprecificadas com o tempo restante.
 */
export function generatePayoffCurve(
  legs: PricingLeg[],
  currentSpot: number,
  evalDaysElapsed: number = 0,
  volShock: number = 0,
  pointsCount: number = 60,
  r: RateInput = DEFAULT_RISK_FREE_RATE
): PayoffPoint[] {
  if (legs.length === 0) return [];

  const { low, high } = priceBounds(legs, currentSpot);
  const step = (high - low) / (pointsCount - 1);
  const horizonBD = nearestExpiryBD(legs);
  const points: PayoffPoint[] = [];

  for (let i = 0; i < pointsCount; i++) {
    const S = low + i * step;

    let payoffToday = 0;
    let delta = 0;
    let gamma = 0;
    let theta = 0;
    let vega = 0;

    for (const leg of legs) {
      const mult = leg.action === 'BUY' ? 1 : -1;
      const qty = leg.quantity;

      if (!isOptionLeg(leg)) {
        payoffToday += mult * (S - leg.entryPrice) * qty;
        delta += mult * qty;
        continue;
      }

      const remaining = legBusinessDays(leg) - evalDaysElapsed;
      const res = evaluateLeg(leg, S, remaining, r, volShock);
      payoffToday += mult * (res.price - leg.entryPrice) * qty;
      delta += mult * res.delta * qty;
      gamma += mult * res.gamma * qty;
      theta += mult * res.theta * qty;
      vega += mult * res.vega * qty;
    }

    const payoffAtExpiry = structurePnlAtHorizon(legs, S, r, horizonBD);

    points.push({
      spotPrice: Number(S.toFixed(2)),
      payoffAtExpiry: Number(payoffAtExpiry.toFixed(2)),
      payoffToday: Number(payoffToday.toFixed(2)),
      delta: Number(delta.toFixed(2)),
      gamma: Number(gamma.toFixed(4)),
      theta: Number(theta.toFixed(2)),
      vega: Number(vega.toFixed(2)),
    });
  }

  return points;
}

/**
 * Breakevens no primeiro vencimento. Calcula só o P&L no horizonte
 * (sem Greeks), por isso é leve mesmo com opções americanas.
 */
export function calculateBreakevens(
  legs: PricingLeg[],
  currentSpot: number,
  r: RateInput = DEFAULT_RISK_FREE_RATE
): number[] {
  if (legs.length === 0) return [];

  const { low, high } = priceBounds(legs, currentSpot);
  const n = 300;
  const step = (high - low) / (n - 1);
  const horizonBD = nearestExpiryBD(legs);

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const S = low + i * step;
    xs.push(S);
    ys.push(structurePnlAtHorizon(legs, S, r, horizonBD));
  }

  const breakevens: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const y1 = ys[i];
    const y2 = ys[i + 1];
    if ((y1 <= 0 && y2 >= 0) || (y1 >= 0 && y2 <= 0)) {
      const diffY = y2 - y1;
      if (Math.abs(diffY) > 0.0001) {
        const factor = -y1 / diffY;
        breakevens.push(Number((xs[i] + factor * (xs[i + 1] - xs[i])).toFixed(2)));
      }
    }
  }

  const unique: number[] = [];
  for (const b of breakevens) {
    if (!unique.some((u) => Math.abs(u - b) < 0.15)) unique.push(b);
  }
  return unique.sort((a, b) => a - b);
}

/**
 * Probabilidade de lucro (PoP) no primeiro vencimento, via integração sobre a distribuição log-normal.
 *
 * - Pernas mais longas são reprecificadas no horizonte (calendar/diagonal corretos).
 * - Vol: média ponderada por quantidade das pernas que vencem no horizonte (aproximação; ignora skew).
 * - Drift padrão: neutro ao risco (r - q). Passe `drift` para usar um retorno esperado "real".
 */
export function calculatePoP(
  legs: PricingLeg[],
  currentSpot: number,
  r: RateInput = DEFAULT_RISK_FREE_RATE,
  options: { drift?: number } = {}
): number {
  if (legs.length === 0) return 0;

  const optionLegs = legs.filter(isOptionLeg);
  const horizonBD = optionLegs.length > 0 ? nearestExpiryBD(legs) : 21; // só ação: ~1 mês
  const T = Math.max(0.5, horizonBD) / BUSINESS_DAYS_PER_YEAR;

  const volLegs = optionLegs.filter((l) => legBusinessDays(l) <= horizonBD);
  const volQty = volLegs.reduce((acc, l) => acc + l.quantity, 0);
  const avgVol =
    volQty > 0
      ? volLegs.reduce((acc, l) => acc + l.iv * l.quantity, 0) / volQty
      : legs[0]?.iv || 0.20;

  const totalQty = optionLegs.reduce((acc, l) => acc + l.quantity, 0);
  const q =
    totalQty > 0
      ? optionLegs.reduce((acc, l) => acc + (l.dividendYield ?? 0) * l.quantity, 0) / totalQty
      : legs[0]?.dividendYield ?? 0;

  const rCont = resolveRate(r, horizonBD);
  const mu = options.drift ?? rCont - q;

  const numSteps = 400;
  const zMin = -5;
  const zMax = 5;
  const dz = (zMax - zMin) / numSteps;
  let profitableProb = 0;

  for (let i = 0; i < numSteps; i++) {
    const z = zMin + (i + 0.5) * dz;
    const S_T = currentSpot * Math.exp((mu - 0.5 * avgVol * avgVol) * T + avgVol * Math.sqrt(T) * z);
    const pnl = structurePnlAtHorizon(legs, S_T, r, horizonBD);
    if (pnl > 1e-9) profitableProb += normalPdf(z) * dz;
  }

  return Number(Math.min(Math.max(profitableProb * 100, 0), 100).toFixed(1));
}

/**
 * Calcula o P&L da estrutura caso o ativo subjacente chegue ao valor de zero (S = 0,00).
 * Contabiliza:
 * - Ações/ETFs comprados: perda integral de 100% do valor de entrada.
 * - Ações/ETFs vendidos: ganho integral do valor de entrada.
 * - CALLs: expiram sem valor (OTM), perdendo o prêmio pago ou retendo o prêmio recebido.
 * - PUTs: atingem o valor máximo do strike K, resultando em perda integral nas vendas descobertas.
 */
export function calculateStructurePnlAtZero(legs: PricingLeg[]): number {
  let totalPnl = 0;
  for (const leg of legs) {
    const mult = leg.action === 'BUY' ? 1 : -1;
    const qty = leg.quantity;

    if (!isOptionLeg(leg)) {
      // Ativo à vista cai para 0,00
      totalPnl += mult * (0 - leg.entryPrice) * qty;
    } else if (leg.type === 'CALL') {
      // Call vale 0 no vencimento
      totalPnl += mult * (0 - leg.entryPrice) * qty;
    } else if (leg.type === 'PUT') {
      // Put vale o strike K integral no vencimento (K - 0 = K)
      totalPnl += mult * (leg.strike - leg.entryPrice) * qty;
    }
  }
  return Number(totalPnl.toFixed(2));
}

/**
 * Determina o valor de capital base de montagem para cálculo percentual de retorno/risco.
 * - Se débito pago na montagem: o próprio débito pago.
 * - Se estrutura com ativo à vista: o valor investido nas ações + custo líquido.
 * - Se estrutura a crédito ou venda de opções: o capital máximo em risco (margem necessária / maxLoss).
 */
export function calculateCapitalBase(
  legs: PricingLeg[],
  totalCost: number,
  maxLoss: number | 'ILIMITADO',
  currentSpot: number
): number {
  if (totalCost > 0) {
    return totalCost;
  }
  const stockLeg = legs.find((l) => !isOptionLeg(l) && l.action === 'BUY');
  if (stockLeg) {
    return Number((stockLeg.entryPrice * stockLeg.quantity + totalCost).toFixed(2));
  }
  if (typeof maxLoss === 'number' && maxLoss > 0) {
    return maxLoss;
  }
  if (Math.abs(totalCost) > 0) {
    return Math.abs(totalCost);
  }
  return currentSpot * 100;
}