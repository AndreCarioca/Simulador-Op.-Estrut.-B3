/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { OptionChainTable } from './components/OptionChainTable';
import { StrategyBuilder } from './components/StrategyBuilder';
import { PayoffChart } from './components/PayoffChart';
import { GreeksVisualizer } from './components/GreeksVisualizer';
import {
  UnderlyingAsset,
  OptionContract,
  ExpirationSeries,
  SimulationLeg,
  StructureMetrics,
  PriceReferenceMode,
} from './types/options';
import {
  INITIAL_UNDERLYINGS,
  generateOptionChainForAsset,
  recalculateOptionChainForSpot,
} from './data/b3MockData';
import {
  calculateBreakevens,
  calculatePoP,
  generatePayoffCurve,
  effectiveToContinuous,
  calculateStructurePnlAtZero,
  calculateCapitalBase,
} from './utils/blackScholes';
import { fetchLiveB3Quotes, B3QuoteItem } from './services/b3QuotesService';
import { BarChart2, LineChart, ShieldAlert, Sparkles, TrendingUp, Info } from 'lucide-react';

const DEFAULT_INTEREST_RATE = 13.65; // 13.65% a.a. (Taxa Selic/DI padrão B3)

export default function App() {
  // Underlying Assets and Selection
  const [underlyings, setUnderlyings] = useState<UnderlyingAsset[]>(INITIAL_UNDERLYINGS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BOVA11');

  // Risk-Free Interest Rate (% a.a.) used for Black-Scholes and structure simulation
  const [interestRate, setInterestRate] = useState<number>(DEFAULT_INTEREST_RATE);
  const continuousRate = useMemo(() => effectiveToContinuous(interestRate / 100), [interestRate]);

  // Pre-generate option chains for all underlyings on initial load (B3 bulletin baseline)
  const [chainsByAsset, setChainsByAsset] = useState<Record<string, ExpirationSeries[]>>(() => {
    const initialChains: Record<string, ExpirationSeries[]> = {};
    const initContinuous = effectiveToContinuous(DEFAULT_INTEREST_RATE / 100);
    for (const asset of INITIAL_UNDERLYINGS) {
      initialChains[asset.symbol] = generateOptionChainForAsset(asset, initContinuous);
    }
    return initialChains;
  });

  const [activeSeriesIndex, setActiveSeriesIndex] = useState<number>(0);

  // Simulation Legs
  const [legs, setLegs] = useState<SimulationLeg[]>([]);
  const [activeTab, setActiveTab] = useState<'payoff' | 'greeks'>('payoff');

  // Currently selected asset data
  const currentAsset = useMemo(() => {
    return underlyings.find((a) => a.symbol === selectedSymbol) || underlyings[0];
  }, [underlyings, selectedSymbol]);

  // Active option series list for selected asset
  const currentSeriesList = useMemo(() => {
    return chainsByAsset[selectedSymbol] || [];
  }, [chainsByAsset, selectedSymbol]);

  // User manually edits or steps the underlying cash asset price
  // Recalculates theoretical fair prices and Greeks in real time for all options of this asset
  const handleUpdateSpotPrice = useCallback((newPrice: number) => {
    // 1. Update underlyings list
    setUnderlyings((prev) =>
      prev.map((u) => {
        if (u.symbol === selectedSymbol) {
          const change = Number((newPrice - u.previousClose).toFixed(2));
          const changePercent = Number(((change / u.previousClose) * 100).toFixed(2));
          return {
            ...u,
            currentPrice: newPrice,
            change,
            changePercent,
          };
        }
        return u;
      })
    );

    // 2. Recalculate options theoretical fair price & greeks for this asset using current interest rate
    setChainsByAsset((prev) => {
      const currentList = prev[selectedSymbol];
      if (!currentList) return prev;
      const updatedList = recalculateOptionChainForSpot(currentList, newPrice, continuousRate);
      return {
        ...prev,
        [selectedSymbol]: updatedList,
      };
    });
  }, [selectedSymbol, continuousRate]);

  // User manually edits or steps the interest rate (Taxa Selic/DI % a.a.)
  // Recalculates theoretical fair prices and Greeks in real time for all assets and option chains
  const handleUpdateInterestRate = useCallback((newRate: number) => {
    setInterestRate(newRate);
    const newContinuous = effectiveToContinuous(newRate / 100);

    setChainsByAsset((prev) => {
      const updated: Record<string, ExpirationSeries[]> = {};
      for (const [sym, chain] of Object.entries(prev)) {
        const asset = underlyings.find((a) => a.symbol === sym);
        const spot = asset ? asset.currentPrice : 100;
        updated[sym] = recalculateOptionChainForSpot(chain, spot, newContinuous);
      }
      return updated;
    });
  }, [underlyings]);

  // Reset interest rate back to default (11.25% a.a.)
  const handleResetInterestRate = useCallback(() => {
    handleUpdateInterestRate(DEFAULT_INTEREST_RATE);
  }, [handleUpdateInterestRate]);

  // Reset spot price back to official B3 previous close baseline
  const handleResetToOfficialClose = useCallback(() => {
    const original = INITIAL_UNDERLYINGS.find((a) => a.symbol === selectedSymbol);
    if (original) {
      handleUpdateSpotPrice(original.currentPrice);
    }
  }, [selectedSymbol, handleUpdateSpotPrice]);

  // B3 Live Synchronization States
  const [isSyncingB3, setIsSyncingB3] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Synchronize quotations from B3 Hub / Brapi and update if different from stored
  const syncB3Quotes = useCallback(
    async (force = false) => {
      setIsSyncingB3(true);
      try {
        const liveQuotes = await fetchLiveB3Quotes(force);
        if (liveQuotes.length > 0) {
          let updatedCount = 0;

          // 1. Update underlyings with fresh B3 live quotes
          setUnderlyings((prev) => {
            return prev.map((asset) => {
              const live = liveQuotes.find((q) => q.symbol === asset.symbol);
              if (live) {
                const priceDiff = Math.abs(live.currentPrice - asset.currentPrice);
                const closeDiff = Math.abs(live.previousClose - asset.previousClose);
                if (priceDiff > 0.001 || closeDiff > 0.001) {
                  updatedCount++;
                }
                return {
                  ...asset,
                  currentPrice: live.currentPrice,
                  previousClose: live.previousClose,
                  change: live.change,
                  changePercent: live.changePercent,
                  high52w: live.high52w ?? asset.high52w,
                  low52w: live.low52w ?? asset.low52w,
                };
              }
              return asset;
            });
          });

          // 2. Re-center and update option chains for the updated spot prices
          setChainsByAsset((prev) => {
            const nextChains = { ...prev };
            for (const live of liveQuotes) {
              const currentAssetObj = underlyings.find((a) => a.symbol === live.symbol);
              const assetToUse: UnderlyingAsset = {
                ...(currentAssetObj || {
                  symbol: live.symbol,
                  name: live.symbol,
                  type: live.symbol.includes('11') ? 'ETF' : 'STOCK',
                  historicalVol: 0.22,
                  high52w: 100,
                  low52w: 50,
                }),
                currentPrice: live.currentPrice,
                previousClose: live.previousClose,
                change: live.change,
                changePercent: live.changePercent,
              };

              nextChains[live.symbol] = generateOptionChainForAsset(assetToUse, continuousRate);
            }
            return nextChains;
          });

          const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          setLastSyncTime(timeStr);

          if (updatedCount > 0) {
            setSyncStatusMsg(`Cotações atualizadas com sucesso: ${updatedCount} ativos sincronizados com o pregão da B3.`);
          } else {
            setSyncStatusMsg(`Cotações da B3 consultadas e verificadas às ${timeStr} (dados congruentes).`);
          }

          setTimeout(() => {
            setSyncStatusMsg(null);
          }, 6000);
        }
      } catch (err) {
        console.error('Falha ao sincronizar cotações com a B3:', err);
      } finally {
        setIsSyncingB3(false);
      }
    },
    [continuousRate, underlyings]
  );

  // Automatic consultation on startup / initial load
  useEffect(() => {
    syncB3Quotes(false);
  }, []);

  // Manual reload button trigger
  const handleReloadB3Data = useCallback(() => {
    syncB3Quotes(true);
  }, [syncB3Quotes]);

  // Sync legs with updated market data whenever chains update
  useEffect(() => {
    if (legs.length === 0) return;

    setLegs((prevLegs) =>
      prevLegs.map((leg) => {
        if (leg.isUnderlying || leg.type === 'STOCK') {
          const asset = underlyings.find((a) => a.symbol === leg.underlying);
          if (asset) {
            return {
              ...leg,
              marketLastPrice: asset.currentPrice,
              fairPrice: asset.currentPrice,
              delta: leg.action === 'BUY' ? 1.0 : -1.0,
            };
          }
          return leg;
        }

        // Find updated contract in chain
        const assetChain = chainsByAsset[leg.underlying] || [];
        for (const series of assetChain) {
          const contract = series.options.find((o) => o.code === leg.optionCode);
          if (contract) {
            let updatedEntry = leg.entryPrice;
            if (leg.priceMode === 'FAIR') {
              updatedEntry = contract.fairPrice;
            } else if (leg.priceMode === 'LAST') {
              updatedEntry = contract.lastPrice;
            }

            return {
              ...leg,
              marketLastPrice: contract.lastPrice,
              fairPrice: contract.fairPrice,
              entryPrice: updatedEntry,
              iv: contract.iv,
              delta: contract.delta,
              gamma: contract.gamma,
              theta: contract.theta,
              vega: contract.vega,
              rho: contract.rho,
            };
          }
        }
        return leg;
      })
    );
  }, [chainsByAsset, underlyings]);

  // Handle adding an underlying stock/ETF leg (with dynamic consolidation / netting)
  const handleAddAssetLeg = (action: 'BUY' | 'SELL') => {
    const asset = currentAsset;
    const deltaQty = action === 'BUY' ? 100 : -100;

    setLegs((prevLegs) => {
      const existingIndex = prevLegs.findIndex(
        (l) => (l.isUnderlying || l.type === 'STOCK') && l.underlying === asset.symbol
      );

      if (existingIndex === -1) {
        const newLeg: SimulationLeg = {
          id: `asset-${asset.symbol}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          optionCode: `${asset.symbol} (À Vista)`,
          underlying: asset.symbol,
          isUnderlying: true,
          type: 'STOCK',
          style: 'N/A',
          strike: asset.currentPrice,
          expirationDate: 'Contínuo',
          daysToExpiration: 0,
          action,
          quantity: 100, // standard lot of 100 shares
          priceMode: 'LAST',
          entryPrice: asset.currentPrice,
          marketLastPrice: asset.currentPrice,
          fairPrice: asset.currentPrice,
          daysSinceLastTrade: 0,
          isStale: false,
          iv: asset.historicalVol,
          delta: 1.0,
          gamma: 0,
          theta: 0,
          vega: 0,
        };
        return [...prevLegs, newLeg];
      }

      const existing = prevLegs[existingIndex];
      const existingSigned = (existing.action === 'BUY' ? 1 : -1) * existing.quantity;
      const newSigned = existingSigned + deltaQty;

      // When net position reaches 0, remove the leg completely from the simulation
      if (newSigned === 0) {
        return prevLegs.filter((_, idx) => idx !== existingIndex);
      }

      const newAction: 'BUY' | 'SELL' = newSigned > 0 ? 'BUY' : 'SELL';
      const newQuantity = Math.abs(newSigned);

      // Average entry price when adding in same direction; replace if direction flipped
      let newEntryPrice = existing.entryPrice;
      if ((existingSigned > 0 && deltaQty > 0) || (existingSigned < 0 && deltaQty < 0)) {
        const totalPaid = existing.entryPrice * existing.quantity + asset.currentPrice * Math.abs(deltaQty);
        newEntryPrice = Number((totalPaid / newQuantity).toFixed(2));
      } else if ((existingSigned > 0 && newSigned < 0) || (existingSigned < 0 && newSigned > 0)) {
        newEntryPrice = asset.currentPrice;
      }

      const updatedLeg: SimulationLeg = {
        ...existing,
        action: newAction,
        quantity: newQuantity,
        entryPrice: newEntryPrice,
        marketLastPrice: asset.currentPrice,
        fairPrice: asset.currentPrice,
        delta: 1.0,
      };

      const next = [...prevLegs];
      next[existingIndex] = updatedLeg;
      return next;
    });
  };

  // Handle adding a leg to simulation (with dynamic consolidation / netting by option code)
  const handleAddLeg = (option: OptionContract, action: 'BUY' | 'SELL') => {
    // Default reference is now the theoretical calculated price (FAIR) which updates dynamically with spot
    const chosenMode: PriceReferenceMode = 'FAIR';
    const chosenPrice = option.fairPrice;

    const deltaQty = action === 'BUY' ? 100 : -100;

    setLegs((prevLegs) => {
      const existingIndex = prevLegs.findIndex((l) => l.optionCode === option.code && !l.isUnderlying);

      if (existingIndex === -1) {
        const newLeg: SimulationLeg = {
          id: `${option.code}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          optionCode: option.code,
          underlying: option.underlying,
          type: option.type,
          style: option.style,
          strike: option.strike,
          expirationDate: option.expirationDate,
          daysToExpiration: option.daysToExpiration,
          action,
          quantity: 100, // Standard B3 lot
          priceMode: chosenMode,
          entryPrice: chosenPrice,
          marketLastPrice: option.lastPrice,
          fairPrice: option.fairPrice,
          daysSinceLastTrade: option.daysSinceLastTrade,
          isStale: option.isStale,
          iv: option.iv,
          delta: option.delta,
          gamma: option.gamma,
          theta: option.theta,
          vega: option.vega,
          rho: option.rho,
        };
        return [...prevLegs, newLeg];
      }

      const existing = prevLegs[existingIndex];
      const existingSigned = (existing.action === 'BUY' ? 1 : -1) * existing.quantity;
      const newSigned = existingSigned + deltaQty;

      // Netting: if user sells 100 and buys 100 (or vice-versa), position becomes 0 and leg is removed
      if (newSigned === 0) {
        return prevLegs.filter((_, idx) => idx !== existingIndex);
      }

      const newAction: 'BUY' | 'SELL' = newSigned > 0 ? 'BUY' : 'SELL';
      const newQuantity = Math.abs(newSigned);

      // Average entry price when adding to same position; reset to trade price if flipped
      let newEntryPrice = existing.entryPrice;
      if ((existingSigned > 0 && deltaQty > 0) || (existingSigned < 0 && deltaQty < 0)) {
        const totalPaid = existing.entryPrice * existing.quantity + chosenPrice * Math.abs(deltaQty);
        newEntryPrice = Number((totalPaid / newQuantity).toFixed(2));
      } else if ((existingSigned > 0 && newSigned < 0) || (existingSigned < 0 && newSigned > 0)) {
        newEntryPrice = chosenPrice;
      }

      const updatedLeg: SimulationLeg = {
        ...existing,
        action: newAction,
        quantity: newQuantity,
        entryPrice: newEntryPrice,
        priceMode: chosenMode,
        marketLastPrice: option.lastPrice,
        fairPrice: option.fairPrice,
        iv: option.iv,
        delta: option.delta,
        gamma: option.gamma,
        theta: option.theta,
        vega: option.vega,
        rho: option.rho,
      };

      const next = [...prevLegs];
      next[existingIndex] = updatedLeg;
      return next;
    });
  };

  // Update a leg (removes if quantity <= 0)
  const handleUpdateLeg = (id: string, updates: Partial<SimulationLeg>) => {
    if (updates.quantity !== undefined && updates.quantity <= 0) {
      setLegs((prev) => prev.filter((l) => l.id !== id));
      return;
    }
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  // Remove a leg
  const handleRemoveLeg = (id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  };

  // Clear all legs
  const handleClearLegs = () => {
    setLegs([]);
  };

  // Flip positions (Buy to Sell, Sell to Buy)
  const handleFlipPositions = () => {
    setLegs((prev) =>
      prev.map((l) => ({
        ...l,
        action: l.action === 'BUY' ? 'SELL' : 'BUY',
      }))
    );
  };

  // Structure Metrics Calculation
  const structureMetrics = useMemo<StructureMetrics>(() => {
    if (legs.length === 0) {
      return {
        totalCost: 0,
        isCredit: false,
        maxProfit: 0,
        maxLoss: 0,
        breakevens: [],
        pop: 0,
        totalDelta: 0,
        totalGamma: 0,
        totalTheta: 0,
        totalVega: 0,
        totalRho: 0,
        riskRewardRatio: 'N/A',
      };
    }

    let netCash = 0;
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    let totalRho = 0;

    for (const leg of legs) {
      const mult = leg.action === 'BUY' ? 1 : -1;
      netCash += mult * leg.entryPrice * leg.quantity;
      totalDelta += mult * leg.delta * leg.quantity;
      totalGamma += mult * leg.gamma * leg.quantity;
      totalTheta += mult * leg.theta * leg.quantity;
      totalVega += mult * leg.vega * leg.quantity;
      totalRho += mult * (leg.rho ?? 0) * leg.quantity;
    }

    const isCredit = netCash < 0;
    const totalCost = Number(netCash.toFixed(2));

    // Calculate payoff range to determine max profit and loss using current dynamic interest rate
    const curvePoints = generatePayoffCurve(legs, currentAsset.currentPrice, undefined, 0, 100, continuousRate);
    const expiryPnls = curvePoints.map((p) => p.payoffAtExpiry);
    const minPnl = Math.min(...expiryPnls);
    const maxPnl = Math.max(...expiryPnls);

    // Check if structure has uncovered legs on the upside (unlimited risk as S -> +infinity)
    const longStock = legs.filter((l) => (l.isUnderlying || l.type === 'STOCK') && l.action === 'BUY').reduce((s, l) => s + l.quantity, 0);
    const shortStock = legs.filter((l) => (l.isUnderlying || l.type === 'STOCK') && l.action === 'SELL').reduce((s, l) => s + l.quantity, 0);
    const longCalls = legs.filter((l) => l.type === 'CALL' && l.action === 'BUY').reduce((s, l) => s + l.quantity, 0);
    const shortCalls = legs.filter((l) => l.type === 'CALL' && l.action === 'SELL').reduce((s, l) => s + l.quantity, 0);

    // Unlimited loss ONLY occurs on upside when short calls + short stock exceed long calls + long stock (S -> +infinity)
    // On the downside, the asset price stops at R$ 0,00 (perda integral até zero, não ilimitada!)
    const hasUnlimitedLoss = (shortCalls + shortStock) > (longCalls + longStock);
    const hasUnlimitedProfit = (longCalls + longStock) > (shortCalls + shortStock);

    // Calculate PnL at S = 0 (perda integral caso o ativo chegue ao valor de zero)
    const pnlAtZero = calculateStructurePnlAtZero(legs);

    // Consider both the sampled curve points AND S = 0 (ruína/queda total do ativo)
    const effectiveMinPnl = Math.min(minPnl, pnlAtZero);
    const effectiveMaxPnl = Math.max(maxPnl, pnlAtZero);

    const maxProfit = hasUnlimitedProfit ? 'ILIMITADO' : Number(effectiveMaxPnl.toFixed(2));
    const maxLoss = hasUnlimitedLoss ? 'ILIMITADO' : Number(Math.abs(effectiveMinPnl).toFixed(2));

    const capitalBase = calculateCapitalBase(legs, totalCost, maxLoss, currentAsset.currentPrice);
    const maxProfitPercent =
      typeof maxProfit === 'number' && capitalBase > 0
        ? Number(((maxProfit / capitalBase) * 100).toFixed(1))
        : undefined;
    const maxLossPercent =
      typeof maxLoss === 'number' && capitalBase > 0
        ? Number(((maxLoss / capitalBase) * 100).toFixed(1))
        : undefined;

    const breakevens = calculateBreakevens(legs, currentAsset.currentPrice, continuousRate);
    const pop = calculatePoP(legs, currentAsset.currentPrice, continuousRate);

    return {
      totalCost,
      isCredit,
      maxProfit,
      maxLoss,
      maxProfitPercent,
      maxLossPercent,
      capitalBase,
      breakevens,
      pop,
      totalDelta: Number(totalDelta.toFixed(1)),
      totalGamma: Number(totalGamma.toFixed(4)),
      totalTheta: Number(totalTheta.toFixed(1)),
      totalVega: Number(totalVega.toFixed(1)),
      totalRho: Number(totalRho.toFixed(2)),
      riskRewardRatio:
        typeof maxProfit === 'number' && typeof maxLoss === 'number' && maxLoss > 0
          ? `1:${(maxProfit / maxLoss).toFixed(2)}`
          : 'N/A',
    };
  }, [legs, currentAsset.currentPrice, continuousRate]);

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header with editable spot and interest rate */}
      <Header
        underlyings={underlyings}
        selectedSymbol={selectedSymbol}
        interestRate={interestRate}
        defaultInterestRate={DEFAULT_INTEREST_RATE}
        isSyncingB3={isSyncingB3}
        lastSyncTime={lastSyncTime}
        onSelectSymbol={setSelectedSymbol}
        onUpdateSpotPrice={handleUpdateSpotPrice}
        onUpdateInterestRate={handleUpdateInterestRate}
        onResetToOfficialClose={handleResetToOfficialClose}
        onResetInterestRate={handleResetInterestRate}
        onManualRefresh={handleReloadB3Data}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 lg:p-5 space-y-4">
        {/* Sync Status Banner */}
        {syncStatusMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs px-4 py-2 rounded-lg flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.25)] font-mono animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
            <button
              onClick={() => setSyncStatusMsg(null)}
              className="text-slate-400 hover:text-white text-xs px-1 hover:bg-slate-800 rounded transition-colors"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Asset Selector Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 pl-1">
            Ativos Líquidos:
          </span>
          {underlyings.map((asset) => {
            const isSelected = asset.symbol === selectedSymbol;
            const isPos = asset.change >= 0;
            return (
              <button
                key={asset.symbol}
                onClick={() => setSelectedSymbol(asset.symbol)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 ${
                  isSelected
                    ? 'bg-slate-800 text-white border border-cyan-500/60 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/80'
                }`}
              >
                <span className="font-bold">{asset.symbol}</span>
                <span className="text-slate-400">R$ {asset.currentPrice.toFixed(2)}</span>
                <span className={isPos ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {isPos ? '+' : ''}
                  {asset.changePercent.toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Section 1: Option Chain (Grade de Opções da B3) */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Grade de Opções B3 · {currentAsset.symbol}
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                (Vol. Histórica: {(currentAsset.historicalVol * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
              <span className="inline-flex items-center gap-1 text-[11px] text-violet-300">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                P. Teórico (Juros: {interestRate.toFixed(2)}% a.a.)
              </span>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                Últ. Neg.
              </span>
            </div>
          </div>

          <OptionChainTable
            underlyingSymbol={currentAsset.symbol}
            currentSpot={currentAsset.currentPrice}
            seriesList={currentSeriesList}
            activeSeriesIndex={activeSeriesIndex}
            onSelectSeriesIndex={setActiveSeriesIndex}
            onAddLeg={handleAddLeg}
            onAddAssetLeg={handleAddAssetLeg}
          />
        </section>

        {/* Section 2: Strategy Simulator & Visualizer (Two Column Grid) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Multi-Leg Strategy Builder (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <StrategyBuilder
              legs={legs}
              metrics={structureMetrics}
              selectedSymbol={currentAsset.symbol}
              currentSpot={currentAsset.currentPrice}
              onUpdateLeg={handleUpdateLeg}
              onRemoveLeg={handleRemoveLeg}
              onClearLegs={handleClearLegs}
              onFlipPositions={handleFlipPositions}
              onAddAssetLeg={handleAddAssetLeg}
            />
          </div>

          {/* Right Column: Interactive Charts (Payoff & Greeks Visualizer) (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            {/* View Switcher Tabs (Payoff vs Greeks) */}
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 p-1 rounded-xl">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('payoff')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'payoff'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Gráfico de Payoff & Sensibilidade</span>
                </button>
                <button
                  onClick={() => setActiveTab('greeks')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'greeks'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Gráficos de Gregas (Δ, Γ, Θ, V)</span>
                </button>
              </div>

              {legs.length > 0 && (
                <div className="text-xs font-mono text-slate-400 pr-2">
                  Prob. Lucro:{' '}
                  <span className="font-bold text-violet-300">{structureMetrics.pop.toFixed(1)}%</span>
                </div>
              )}
            </div>

            {/* Active Chart View */}
            {activeTab === 'payoff' ? (
              <PayoffChart
                legs={legs}
                currentSpot={currentAsset.currentPrice}
                metrics={structureMetrics}
                riskFreeRate={continuousRate}
              />
            ) : (
              <GreeksVisualizer
                legs={legs}
                currentSpot={currentAsset.currentPrice}
                metrics={structureMetrics}
                riskFreeRate={continuousRate}
              />
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#060810] py-3.5 px-6 text-center text-xs text-slate-500 font-mono mt-8">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>B3 Opções · Simulador de Negociações & Risco com Precificação Black-Scholes</span>
          <span className="text-slate-600">Ambiente de Simulação de Derivativos B3</span>
        </div>
      </footer>
    </div>
  );
}
