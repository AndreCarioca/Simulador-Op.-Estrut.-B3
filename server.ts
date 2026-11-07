import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

interface QuoteResult {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high52w?: number;
  low52w?: number;
  source: string;
  updatedAt: string;
}

const SYMBOLS_TO_FETCH = [
  'BOVA11',
  'SMAL11',
  'PETR4',
  'VALE3',
  'ITUB4',
  'BBDC4',
  'B3SA3',
  'BBAS3',
  'MGLU3',
  'ABEV3',
  'WEGE3',
  'RENT3',
  'SUZB3',
  'PRIO3',
];

// In-memory cache for 60 seconds
let cachedQuotes: QuoteResult[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000;

async function fetchQuoteFromYahoo(symbol: string): Promise<QuoteResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.SA?interval=1d&range=1d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;

    const currentPrice = Number(meta.regularMarketPrice.toFixed(2));
    const previousClose = Number(
      (meta.chartPreviousClose || meta.previousClose || currentPrice).toFixed(2)
    );
    const change = Number((currentPrice - previousClose).toFixed(2));
    const changePercent = Number(
      (previousClose > 0 ? (change / previousClose) * 100 : 0).toFixed(2)
    );

    return {
      symbol,
      currentPrice,
      previousClose,
      change,
      changePercent,
      high52w: meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh.toFixed(2)) : undefined,
      low52w: meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow.toFixed(2)) : undefined,
      source: 'B3/MarketData',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchQuoteFromBrapi(symbol: string): Promise<QuoteResult | null> {
  try {
    const url = `https://brapi.dev/api/v2/stocks/quote?symbols=${symbol}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const item = data?.results?.[0]?.data;
    if (!item || typeof item.regularMarketPrice !== 'number') return null;

    const currentPrice = Number(item.regularMarketPrice.toFixed(2));
    const previousClose = Number((item.regularMarketPreviousClose || currentPrice).toFixed(2));
    const change = Number((item.regularMarketChange || currentPrice - previousClose).toFixed(2));
    const changePercent = Number(
      (item.regularMarketChangePercent || (previousClose > 0 ? (change / previousClose) * 100 : 0)).toFixed(2)
    );

    return {
      symbol,
      currentPrice,
      previousClose,
      change,
      changePercent,
      high52w: item.fiftyTwoWeekHigh ? Number(item.fiftyTwoWeekHigh.toFixed(2)) : undefined,
      low52w: item.fiftyTwoWeekLow ? Number(item.fiftyTwoWeekLow.toFixed(2)) : undefined,
      source: 'Brapi/B3',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchAllQuotes(force = false): Promise<QuoteResult[]> {
  const now = Date.now();
  if (!force && cachedQuotes.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedQuotes;
  }

  const results: QuoteResult[] = [];
  await Promise.all(
    SYMBOLS_TO_FETCH.map(async (sym) => {
      // Try Brapi first for whitelisted assets, or Yahoo
      let quote: QuoteResult | null = null;
      if (['PETR4', 'VALE3', 'ITUB4', 'MGLU3'].includes(sym)) {
        quote = await fetchQuoteFromBrapi(sym);
      }
      if (!quote) {
        quote = await fetchQuoteFromYahoo(sym);
      }
      if (!quote) {
        quote = await fetchQuoteFromBrapi(sym);
      }
      if (quote) {
        results.push(quote);
      }
    })
  );

  if (results.length > 0) {
    cachedQuotes = results;
    lastFetchTime = now;
  }

  return cachedQuotes;
}

async function start() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // API Route to fetch latest B3 quotes
  app.get('/api/b3/quotes', async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const quotes = await fetchAllQuotes(force);
      res.json({
        success: true,
        count: quotes.length,
        timestamp: Date.now(),
        asOfDate: new Date().toLocaleDateString('pt-BR'),
        quotes,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Erro ao consultar cotações da B3',
      });
    }
  });

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
