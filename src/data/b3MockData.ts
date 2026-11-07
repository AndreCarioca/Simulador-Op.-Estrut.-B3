import { UnderlyingAsset, OptionContract, ExpirationSeries } from '../types/options';
import { calculateBlackScholes, DEFAULT_RISK_FREE_RATE } from '../utils/blackScholes';

/**
 * Format authentic B3 option ticker (e.g. PETRK46, BOVAK163, VALEK62, BBDCK14, MGLUK55)
 * Eliminates extra zero for integer strikes.
 */
export function formatB3OptionTicker(symbol: string, seriesLetter: string, strike: number): string {
  const root = symbol.slice(0, 4);
  let strikePart = '';

  // If strike is an integer (e.g. 163, 46, 62, 14, 40)
  if (Math.abs(strike - Math.round(strike)) < 0.001) {
    strikePart = Math.round(strike).toString();
  } else {
    // If strike has decimals (e.g. 45.50 -> 455, 14.25 -> 1425)
    const formatted = strike.toFixed(2);
    if (formatted.endsWith('0')) {
      strikePart = strike.toFixed(1).replace('.', '');
    } else {
      strikePart = formatted.replace('.', '');
    }
  }

  return `${root}${seriesLetter}${strikePart}`;
}

export const INITIAL_UNDERLYINGS: UnderlyingAsset[] = [
  {
    symbol: 'BOVA11',
    name: 'iShares Ibovespa Fundo de Índice',
    type: 'ETF',
    currentPrice: 165.93,
    previousClose: 163.03,
    change: 2.90,
    changePercent: 1.78,
    historicalVol: 0.175,
    high52w: 207.00,
    low52w: 140.00,
  },
  {
    symbol: 'SMAL11',
    name: 'iShares BM&FBOVESPA Small Cap ETF',
    type: 'ETF',
    currentPrice: 97.01,
    previousClose: 94.05,
    change: 2.96,
    changePercent: 3.15,
    historicalVol: 0.205,
    high52w: 140.20,
    low52w: 68.81,
  },
  {
    symbol: 'PETR4',
    name: 'Petróleo Brasileiro S.A. Petrobras PN',
    type: 'STOCK',
    currentPrice: 45.36,
    previousClose: 45.95,
    change: -0.59,
    changePercent: -1.28,
    historicalVol: 0.285,
    high52w: 59.79,
    low52w: 29.53,
  },
  {
    symbol: 'VALE3',
    name: 'Vale S.A. ON',
    type: 'STOCK',
    currentPrice: 64.04,
    previousClose: 62.67,
    change: 1.37,
    changePercent: 2.19,
    historicalVol: 0.255,
    high52w: 91.62,
    low52w: 59.42,
  },
  {
    symbol: 'ITUB4',
    name: 'Itaú Unibanco Holding S.A. PN',
    type: 'STOCK',
    currentPrice: 40.53,
    previousClose: 39.97,
    change: 0.56,
    changePercent: 1.40,
    historicalVol: 0.195,
    high52w: 50.85,
    low52w: 37.35,
  },
  {
    symbol: 'BBDC4',
    name: 'Banco Bradesco S.A. PN',
    type: 'STOCK',
    currentPrice: 14.20,
    previousClose: 13.77,
    change: 0.43,
    changePercent: 3.12,
    historicalVol: 0.230,
    high52w: 23.00,
    low52w: 13.44,
  },
  {
    symbol: 'B3SA3',
    name: 'B3 S.A. - Brasil, Bolsa, Balcão ON',
    type: 'STOCK',
    currentPrice: 14.35,
    previousClose: 14.45,
    change: -0.10,
    changePercent: -0.69,
    historicalVol: 0.245,
    high52w: 15.10,
    low52w: 10.20,
  },
  {
    symbol: 'BBAS3',
    name: 'Banco do Brasil S.A. ON',
    type: 'STOCK',
    currentPrice: 17.13,
    previousClose: 16.49,
    change: 0.64,
    changePercent: 3.88,
    historicalVol: 0.240,
    high52w: 27.81,
    low52w: 16.08,
  },
  {
    symbol: 'MGLU3',
    name: 'Magazine Luiza S.A. ON',
    type: 'STOCK',
    currentPrice: 5.61,
    previousClose: 5.43,
    change: 0.18,
    changePercent: 3.32,
    historicalVol: 0.460,
    high52w: 13.93,
    low52w: 3.76,
  },
  {
    symbol: 'ABEV3',
    name: 'Ambev S.A. ON',
    type: 'STOCK',
    currentPrice: 15.35,
    previousClose: 15.20,
    change: 0.15,
    changePercent: 0.99,
    historicalVol: 0.170,
    high52w: 16.20,
    low52w: 11.20,
  },
];

export interface ExpirationConfig {
  expirationDate: string;
  daysToExpiration: number;
  businessDays: number;
  label: string;
  callSeriesLetter: string;
  putSeriesLetter: string;
}

export const CALL_SERIES_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
export const PUT_SERIES_LETTERS = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'];
const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Calculates the 3rd Friday of a given year and month (B3 standard monthly expiration)
 */
export function getB3ThirdFriday(year: number, monthIndex: number): Date {
  const d = new Date(Date.UTC(year, monthIndex, 1, 17, 0, 0));
  const dayOfWeek = d.getUTCDay(); // 0 = Sun, 5 = Fri
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  const thirdFriday = firstFriday + 14;
  return new Date(Date.UTC(year, monthIndex, thirdFriday, 17, 0, 0));
}

/**
 * Counts business days (Monday to Friday) between two dates
 */
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
  }
  return Math.max(1, count);
}

/**
 * Dynamically computes 6 monthly expirations on initialization:
 * current monthly expiration + next 5 monthly expirations = 6 months horizon
 */
export function getDynamicMonthlyExpirations(baseDate: Date = new Date('2026-11-06T12:00:00Z')): ExpirationConfig[] {
  const configs: ExpirationConfig[] = [];
  let curYear = baseDate.getFullYear();
  let curMonth = baseDate.getMonth();

  // If current date has already passed the 3rd Friday of this month, begin next month
  const thisMonthExpiry = getB3ThirdFriday(curYear, curMonth);
  if (baseDate.getTime() > thisMonthExpiry.getTime()) {
    curMonth += 1;
    if (curMonth > 11) {
      curMonth = 0;
      curYear += 1;
    }
  }

  // Generate 6 consecutive monthly expirations
  for (let i = 0; i < 6; i++) {
    let targetMonth = curMonth + i;
    let targetYear = curYear;
    while (targetMonth > 11) {
      targetMonth -= 12;
      targetYear += 1;
    }

    const expiryDate = getB3ThirdFriday(targetYear, targetMonth);
    const diffMs = expiryDate.getTime() - baseDate.getTime();
    const daysToExpiration = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    const businessDays = calculateBusinessDays(baseDate, expiryDate);

    const yearStr = targetYear.toString();
    const monthStr = (targetMonth + 1).toString().padStart(2, '0');
    const dayStr = expiryDate.getUTCDate().toString().padStart(2, '0');
    const isoDate = `${yearStr}-${monthStr}-${dayStr}`;

    const monthAbbr = MONTH_NAMES_PT[targetMonth];
    const label = `${dayStr}/${monthAbbr}/${yearStr.slice(-2)} (${daysToExpiration}d)`;

    configs.push({
      expirationDate: isoDate,
      daysToExpiration,
      businessDays,
      label,
      callSeriesLetter: CALL_SERIES_LETTERS[targetMonth],
      putSeriesLetter: PUT_SERIES_LETTERS[targetMonth],
    });
  }

  return configs;
}

/**
 * Generate full chain of options for a given underlying asset
 * using the dynamic 6 monthly expirations horizon (current + 5 next months)
 */
export function generateOptionChainForAsset(
  asset: UnderlyingAsset,
  riskFreeRate: number = DEFAULT_RISK_FREE_RATE
): ExpirationSeries[] {
  const currentSpot = asset.currentPrice;
  const seriesList: ExpirationSeries[] = [];
  const expirations = getDynamicMonthlyExpirations();

  // Determine strike step based on asset price magnitude & asset type
  // In B3: BOVA11 has strikes at EVERY R$ 1.00 (both odd and even, e.g. 161, 162, 163, 164...)
  let strikeStep = 0.50;
  if (asset.symbol === 'BOVA11' || asset.symbol === 'SMAL11') {
    strikeStep = 1.0;
  } else if (currentSpot > 50) {
    strikeStep = 1.0;
  } else if (currentSpot > 20) {
    strikeStep = 0.50;
  } else {
    strikeStep = 0.25;
  }

  // Generate strikes centered around ATM (55 below, ATM, 55 above)
  // to fully satisfy the ±6, ±15, ±30, and ±50 (Todos) strikes per side requirements
  const atmBase = Math.round(currentSpot / strikeStep) * strikeStep;
  const strikes: number[] = [];
  for (let s = -55; s <= 55; s++) {
    const strike = Number((atmBase + s * strikeStep).toFixed(2));
    if (strike > 0) {
      strikes.push(strike);
    }
  }

  for (const exp of expirations) {
    const T = Math.max(0.0001, exp.daysToExpiration / 365);
    const options: OptionContract[] = [];

    for (const strike of strikes) {
      const moneyness = strike / currentSpot; // strike vs spot
      const distanceAtm = Math.abs(strike - currentSpot);

      // Realistic B3 Volatility Smile: Puts have positive skew, OTM calls slightly lower IV
      const skewFactor = moneyness < 1 ? Math.pow(1 - moneyness, 1.2) * 0.45 : Math.pow(moneyness - 1, 1.1) * 0.25;
      const baseIv = asset.historicalVol + 0.03; // IV slightly above historical vol
      const callIv = Number(Math.max(0.12, baseIv + skewFactor * 0.7).toFixed(3));
      const putIv = Number(Math.max(0.14, baseIv + skewFactor * 1.1).toFixed(3));

      // Calculate Black-Scholes theoretical fair price with dynamic risk-free rate
      const callBs = calculateBlackScholes(currentSpot, strike, T, riskFreeRate, callIv, 'CALL');
      const putBs = calculateBlackScholes(currentSpot, strike, T, riskFreeRate, putIv, 'PUT');

      const callFair = Number(callBs.price.toFixed(2));
      const putFair = Number(putBs.price.toFixed(2));

      // Simulate trading activity and stale days (> 7 days rule)
      const relativeDist = distanceAtm / currentSpot;
      let callDaysSinceLastTrade = 0;
      let putDaysSinceLastTrade = 0;

      if (relativeDist > 0.12) {
        callDaysSinceLastTrade = Math.floor(8 + Math.random() * 18);
        putDaysSinceLastTrade = Math.floor(7 + Math.random() * 15);
      } else if (relativeDist > 0.06) {
        callDaysSinceLastTrade = Math.random() > 0.4 ? Math.floor(8 + Math.random() * 10) : Math.floor(Math.random() * 4);
        putDaysSinceLastTrade = Math.random() > 0.4 ? Math.floor(8 + Math.random() * 10) : Math.floor(Math.random() * 4);
      } else {
        callDaysSinceLastTrade = Math.random() > 0.8 ? 2 : 0;
        putDaysSinceLastTrade = Math.random() > 0.8 ? 2 : 0;
      }

      const callIsStale = callDaysSinceLastTrade > 7;
      const putIsStale = putDaysSinceLastTrade > 7;

      let callLastPrice = callFair;
      if (callIsStale) {
        const drift = (Math.random() - 0.5) * 0.45 * callFair;
        callLastPrice = Math.max(0.01, Number((callFair + drift).toFixed(2)));
      } else {
        callLastPrice = Math.max(0.01, Number((callFair * (1 + (Math.random() - 0.5) * 0.05)).toFixed(2)));
      }

      let putLastPrice = putFair;
      if (putIsStale) {
        const drift = (Math.random() - 0.5) * 0.45 * putFair;
        putLastPrice = Math.max(0.01, Number((putFair + drift).toFixed(2)));
      } else {
        putLastPrice = Math.max(0.01, Number((putFair * (1 + (Math.random() - 0.5) * 0.05)).toFixed(2)));
      }

      // Format standard B3 option codes
      const baseCallTicker = formatB3OptionTicker(asset.symbol, exp.callSeriesLetter, strike);
      const putCode = formatB3OptionTicker(asset.symbol, exp.putSeriesLetter, strike);

      // Volumes & Open Interest
      const baseVol = Math.max(50, Math.floor(12000 / (1 + distanceAtm * 15)));
      const callVol = callIsStale ? 0 : Math.floor(baseVol * (0.8 + Math.random() * 1.2));
      const putVol = putIsStale ? 0 : Math.floor(baseVol * (0.7 + Math.random() * 1.1));

      // REGRA PROFIT (NELOGICA) & B3:
      // 1. PUTS: Tanto para Ações quanto para ETFs (BOVA11, SMAL11), todas as Puts são estritamente EUROPEIAS [E].
      // 2. CALLS: Tanto para Ações quanto para ETFs, existem opções de compra AMERICANAS [A] e EUROPEIAS [E].
      // Geramos ambas as séries de Calls para máxima flexibilidade e precisão:
      
      // 2a. Call Americana [A]
      options.push({
        code: baseCallTicker,
        underlying: asset.symbol,
        type: 'CALL',
        style: 'AMERICANA',
        strike,
        expirationDate: exp.expirationDate,
        daysToExpiration: exp.daysToExpiration,
        businessDays: exp.businessDays,
        lastPrice: callLastPrice,
        lastTradeDate: getPastDateString(callDaysSinceLastTrade),
        daysSinceLastTrade: callDaysSinceLastTrade,
        isStale: callIsStale,
        volume: callVol,
        openInterest: Math.floor(callVol * 4.5 + 500),
        iv: callIv,
        fairPrice: callFair,
        bid: Number(Math.max(0.01, callFair * 0.96).toFixed(2)),
        ask: Number((callFair * 1.04).toFixed(2)),
        delta: Number(callBs.delta.toFixed(3)),
        gamma: Number(callBs.gamma.toFixed(4)),
        theta: Number(callBs.theta.toFixed(3)),
        vega: Number(callBs.vega.toFixed(3)),
        rho: Number(callBs.rho.toFixed(4)),
      });

      // 2b. Call Européia [E] (identificada na B3 com sufixo E ou série específica)
      options.push({
        code: `${baseCallTicker}E`,
        underlying: asset.symbol,
        type: 'CALL',
        style: 'EUROPEIA',
        strike,
        expirationDate: exp.expirationDate,
        daysToExpiration: exp.daysToExpiration,
        businessDays: exp.businessDays,
        lastPrice: Number((callLastPrice * 0.995).toFixed(2)),
        lastTradeDate: getPastDateString(callDaysSinceLastTrade),
        daysSinceLastTrade: callDaysSinceLastTrade,
        isStale: callIsStale,
        volume: Math.floor(callVol * 0.6),
        openInterest: Math.floor(callVol * 2.5 + 200),
        iv: callIv,
        fairPrice: callFair,
        bid: Number(Math.max(0.01, callFair * 0.96).toFixed(2)),
        ask: Number((callFair * 1.04).toFixed(2)),
        delta: Number(callBs.delta.toFixed(3)),
        gamma: Number(callBs.gamma.toFixed(4)),
        theta: Number(callBs.theta.toFixed(3)),
        vega: Number(callBs.vega.toFixed(3)),
        rho: Number(callBs.rho.toFixed(4)),
      });

      // 1. Put Européia [E] (Padrão absoluto da B3 e Profit para Ações e ETFs)
      options.push({
        code: putCode,
        underlying: asset.symbol,
        type: 'PUT',
        style: 'EUROPEIA',
        strike,
        expirationDate: exp.expirationDate,
        daysToExpiration: exp.daysToExpiration,
        businessDays: exp.businessDays,
        lastPrice: putLastPrice,
        lastTradeDate: getPastDateString(putDaysSinceLastTrade),
        daysSinceLastTrade: putDaysSinceLastTrade,
        isStale: putIsStale,
        volume: putVol,
        openInterest: Math.floor(putVol * 4.2 + 400),
        iv: putIv,
        fairPrice: putFair,
        bid: Number(Math.max(0.01, putFair * 0.95).toFixed(2)),
        ask: Number((putFair * 1.05).toFixed(2)),
        delta: Number(putBs.delta.toFixed(3)),
        gamma: Number(putBs.gamma.toFixed(4)),
        theta: Number(putBs.theta.toFixed(3)),
        vega: Number(putBs.vega.toFixed(3)),
        rho: Number(putBs.rho.toFixed(4)),
      });
    }

    seriesList.push({
      expirationDate: exp.expirationDate,
      daysToExpiration: exp.daysToExpiration,
      businessDays: exp.businessDays,
      label: exp.label,
      callSeriesLetter: exp.callSeriesLetter,
      putSeriesLetter: exp.putSeriesLetter,
      options,
    });
  }

  return seriesList;
}

function getPastDateString(daysAgo: number): string {
  const d = new Date('2026-11-06T12:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

/**
 * Recalculate Black-Scholes Theoretical Fair Price and Greeks for an entire option chain
 * whenever the user adjusts the underlying cash asset price.
 * The official last traded price (lastPrice) remains frozen as received from B3 initialization.
 */
export function recalculateOptionChainForSpot(
  seriesList: ExpirationSeries[],
  newSpot: number,
  riskFreeRate: number = DEFAULT_RISK_FREE_RATE
): ExpirationSeries[] {
  return seriesList.map((series) => {
    const T = Math.max(0.0001, series.daysToExpiration / 365);

    const updatedOptions = series.options.map((opt) => {
      const bs = calculateBlackScholes(newSpot, opt.strike, T, riskFreeRate, opt.iv, opt.type);
      const newFair = Number(bs.price.toFixed(2));

      return {
        ...opt,
        fairPrice: newFair,
        bid: Number(Math.max(0.01, newFair * 0.96).toFixed(2)),
        ask: Number((newFair * 1.04).toFixed(2)),
        delta: Number(bs.delta.toFixed(3)),
        gamma: Number(bs.gamma.toFixed(4)),
        theta: Number(bs.theta.toFixed(3)),
        vega: Number(bs.vega.toFixed(3)),
        rho: Number(bs.rho.toFixed(4)),
      };
    });

    return {
      ...series,
      options: updatedOptions,
    };
  });
}
