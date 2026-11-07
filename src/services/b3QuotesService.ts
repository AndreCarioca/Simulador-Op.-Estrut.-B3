/**
 * Service to consult and synchronize live/daily B3 quotes from B3/Brapi Hub.
 */

export interface B3QuoteItem {
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

export interface B3QuotesResponse {
  success: boolean;
  count: number;
  timestamp: number;
  asOfDate: string;
  quotes: B3QuoteItem[];
}

const LOCAL_STORAGE_KEY = 'b3_daily_quotes_cache_v1';

/**
 * Fetch quotes via the server endpoint /api/b3/quotes with direct client-side fallback
 */
export async function fetchLiveB3Quotes(force = false): Promise<B3QuoteItem[]> {
  try {
    // 1. Try backend aggregator route /api/b3/quotes
    const res = await fetch(`/api/b3/quotes${force ? '?force=true' : ''}`, {
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data: B3QuotesResponse = await res.json();
      if (data.success && Array.isArray(data.quotes) && data.quotes.length > 0) {
        // Cache to localStorage for persistence across reloads
        try {
          localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              asOfDate: data.asOfDate,
              quotes: data.quotes,
            })
          );
        } catch {
          // ignore localStorage error
        }
        return data.quotes;
      }
    }
  } catch (err) {
    console.warn('Backend /api/b3/quotes not reachable, trying client fallback:', err);
  }

  // 2. Direct client fallback via Brapi CORS for accessible tickers
  const fallbackSymbols = ['PETR4', 'VALE3', 'ITUB4', 'MGLU3'];
  const directQuotes: B3QuoteItem[] = [];

  await Promise.all(
    fallbackSymbols.map(async (sym) => {
      try {
        const res = await fetch(`https://brapi.dev/api/v2/stocks/quote?symbols=${sym}`);
        if (res.ok) {
          const data = await res.json();
          const item = data?.results?.[0]?.data;
          if (item && typeof item.regularMarketPrice === 'number') {
            const currentPrice = Number(item.regularMarketPrice.toFixed(2));
            const previousClose = Number(
              (item.regularMarketPreviousClose || currentPrice).toFixed(2)
            );
            const change = Number(
              (item.regularMarketChange || currentPrice - previousClose).toFixed(2)
            );
            const changePercent = Number(
              (
                item.regularMarketChangePercent ||
                (previousClose > 0 ? (change / previousClose) * 100 : 0)
              ).toFixed(2)
            );

            directQuotes.push({
              symbol: sym,
              currentPrice,
              previousClose,
              change,
              changePercent,
              high52w: item.fiftyTwoWeekHigh ? Number(item.fiftyTwoWeekHigh.toFixed(2)) : undefined,
              low52w: item.fiftyTwoWeekLow ? Number(item.fiftyTwoWeekLow.toFixed(2)) : undefined,
              source: 'Brapi Client',
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch {
        // ignore individual ticker error
      }
    })
  );

  if (directQuotes.length > 0) {
    return directQuotes;
  }

  // 3. Last fallback: cached quotes from localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.quotes) && parsed.quotes.length > 0) {
        return parsed.quotes;
      }
    }
  } catch {
    // ignore
  }

  return [];
}
