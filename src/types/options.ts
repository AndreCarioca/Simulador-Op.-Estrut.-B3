export type OptionType = 'CALL' | 'PUT';
export type OptionStyle = 'EUROPEIA' | 'AMERICANA';
export type LegAction = 'BUY' | 'SELL';
export type PriceReferenceMode = 'FAIR' | 'LAST' | 'CUSTOM';

export interface UnderlyingAsset {
  symbol: string;
  name: string;
  type: 'ETF' | 'STOCK';
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  historicalVol: number; // e.g. 0.28 for 28%
  high52w: number;
  low52w: number;
}

export interface OptionContract {
  code: string;
  underlying: string;
  type: OptionType;
  style: OptionStyle;
  strike: number;
  expirationDate: string; // YYYY-MM-DD
  daysToExpiration: number; // calendar days
  businessDays: number;
  lastPrice: number;
  lastTradeDate: string; // YYYY-MM-DD
  daysSinceLastTrade: number;
  isStale: boolean; // > 7 days without trades
  volume: number;
  openInterest: number;
  iv: number; // Implied volatility (e.g. 0.32)
  fairPrice: number; // Black-Scholes theoretical price
  bid: number;
  ask: number;
  // Greeks
  delta: number;
  gamma: number;
  theta: number; // daily theta in R$
  vega: number; // vega per 1% vol
  rho: number;
}

export interface ExpirationSeries {
  expirationDate: string;
  daysToExpiration: number;
  businessDays: number;
  label: string;
  callSeriesLetter: string;
  putSeriesLetter: string;
  options: OptionContract[];
}

export interface SimulationLeg {
  id: string;
  optionCode: string;
  underlying: string;
  isUnderlying?: boolean;
  type: OptionType | 'STOCK';
  style: OptionStyle | 'N/A';
  strike: number;
  expirationDate: string;
  daysToExpiration: number;
  action: LegAction; // BUY or SELL
  quantity: number; // usually multiples of 100
  priceMode: PriceReferenceMode;
  entryPrice: number; // execution/simulated price
  marketLastPrice: number;
  fairPrice: number;
  daysSinceLastTrade: number;
  isStale: boolean;
  iv: number;
  // Individual Greeks
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho?: number;
}

export interface StructureMetrics {
  totalCost: number; // positive = debit paid, negative = credit received
  isCredit: boolean;
  maxProfit: number | 'ILIMITADO';
  maxLoss: number | 'ILIMITADO';
  maxProfitPercent?: number;
  maxLossPercent?: number;
  capitalBase?: number;
  breakevens: number[];
  pop: number; // Probability of Profit in percentage (0 - 100)
  totalDelta: number;
  totalGamma: number;
  totalTheta: number; // daily decay in R$
  totalVega: number; // R$ per 1% vol shift
  totalRho: number;
  riskRewardRatio: string;
}

export interface PayoffPoint {
  spotPrice: number;
  payoffAtExpiry: number;
  payoffToday: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}
