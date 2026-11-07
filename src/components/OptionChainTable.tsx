import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Calendar } from 'lucide-react';
import { OptionContract, ExpirationSeries, PriceReferenceMode } from '../types/options';
import { StyleFlagBadge, AmericanFlag, EuropeanFlag } from './FlagIcon';

/**
 * Regra de estilo para opções de compra (CALL):
 * - Calls de todos os ativos na B3 podem ser emitidas nos dois modelos: Americano [A] ou Europeu [E].
 * - Exclusivamente em BOVA11, aplica-se o filtro de paridade automática:
 *   Se o mês de vencimento é ímpar:
 *     - Cotação (strike) ímpar: Tipo Americana [A]
 *     - Cotação (strike) par: Tipo Européia [E]
 *   Se o mês de vencimento é par:
 *     - Cotação (strike) par: Tipo Americana [A]
 *     - Cotação (strike) ímpar: Tipo Européia [E]
 * - Demais ativos: padrão de liquidez Americana [A].
 * O usuário pode alternar manualmente qualquer linha clicando no badge [A]/[E].
 */
export function getAutomaticCallStyle(
  symbol: string,
  expirationDate: string,
  strike: number
): 'AMERICANA' | 'EUROPEIA' {
  if (symbol === 'BOVA11') {
    const monthNum = parseInt(expirationDate.split('-')[1], 10);
    const isMonthOdd = monthNum % 2 !== 0;
    const isStrikeOdd = Math.round(strike) % 2 !== 0;

    if (isMonthOdd) {
      // Mês ímpar: Cotação ímpar -> Americana, Cotação par -> Européia
      return isStrikeOdd ? 'AMERICANA' : 'EUROPEIA';
    } else {
      // Mês par: Cotação par -> Americana, Cotação ímpar -> Européia
      return isStrikeOdd ? 'EUROPEIA' : 'AMERICANA';
    }
  }

  return 'AMERICANA';
}

interface OptionChainTableProps {
  underlyingSymbol: string;
  currentSpot: number;
  seriesList: ExpirationSeries[];
  activeSeriesIndex: number;
  onSelectSeriesIndex: (index: number) => void;
  globalPriceMode?: PriceReferenceMode;
  onAddLeg: (option: OptionContract, action: 'BUY' | 'SELL') => void;
  onAddAssetLeg: (action: 'BUY' | 'SELL') => void;
}

export const OptionChainTable: React.FC<OptionChainTableProps> = ({
  underlyingSymbol,
  currentSpot,
  seriesList,
  activeSeriesIndex,
  onSelectSeriesIndex,
  onAddLeg,
  onAddAssetLeg,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  // Amplitude de strikes: 6 por padrão, 15, 30 e 50 (Todos = ±50 cotações a partir do ATM)
  const [strikeLimit, setStrikeLimit] = useState<number>(6);
  const [strikeStyleOverrides, setStrikeStyleOverrides] = useState<Record<number, 'AMERICANA' | 'EUROPEIA'>>({});
  const activeSeries = seriesList[activeSeriesIndex] || seriesList[0];

  // Reseta substituições manuais ao trocar de ativo ou vencimento para que a regra automática prevaleça
  useEffect(() => {
    setStrikeStyleOverrides({});
  }, [underlyingSymbol, activeSeries?.expirationDate]);

  // Group options by strike, segregating American Calls, European Calls, and Puts
  const strikesMap = new Map<number, { callAmerican?: OptionContract; callEuropean?: OptionContract; put?: OptionContract }>();
  for (const opt of activeSeries.options) {
    if (!strikesMap.has(opt.strike)) {
      strikesMap.set(opt.strike, {});
    }
    const item = strikesMap.get(opt.strike)!;
    if (opt.type === 'CALL') {
      if (opt.style === 'AMERICANA') {
        item.callAmerican = opt;
      } else {
        item.callEuropean = opt;
      }
    } else {
      item.put = opt;
    }
  }

  const sortedStrikes = Array.from(strikesMap.keys()).sort((a, b) => a - b);

  // Find closest strike index to ATM
  const atmIndex = sortedStrikes.reduce((closestIdx, currStrike, idx) => {
    return Math.abs(currStrike - currentSpot) < Math.abs(sortedStrikes[closestIdx] - currentSpot)
      ? idx
      : closestIdx;
  }, 0);
  const atmStrike = sortedStrikes[atmIndex];

  // Scope strikes around ATM: quantidade escolhida para CADA LADO a partir do ATM
  // ±6: 6 OTM e 6 ITM; Todos (±50): 50 OTM e 50 ITM a partir do ATM
  const countPerSide = strikeLimit;
  const start = Math.max(0, atmIndex - countPerSide);
  const end = Math.min(sortedStrikes.length, atmIndex + countPerSide + 1);
  const strikesInScope = sortedStrikes.slice(start, end);

  // Toggle call style between American and European for an individual strike
  const toggleCallStyleForStrike = (strikeNum: number) => {
    setStrikeStyleOverrides((prev) => {
      const defaultStyle = getAutomaticCallStyle(underlyingSymbol, activeSeries.expirationDate, strikeNum);
      const current = prev[strikeNum] || defaultStyle;
      return {
        ...prev,
        [strikeNum]: current === 'AMERICANA' ? 'EUROPEIA' : 'AMERICANA',
      };
    });
  };

  // Filter strikes by search query
  const filteredStrikes = strikesInScope.filter((strike) => {
    if (!filterQuery) return true;
    const s = strike.toString();
    const item = strikesMap.get(strike);
    return (
      s.includes(filterQuery) ||
      item?.callAmerican?.code.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item?.callEuropean?.code.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item?.put?.code.toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  return (
    <div className="bg-[#0b101d] border border-slate-800/80 rounded-xl overflow-hidden flex flex-col h-full shadow-lg">
      {/* Top Header Controls: Expiration Series & Search */}
      <div className="p-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-[#0d1424]">
        {/* Expiration Series Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {seriesList.map((series, idx) => {
            const isActive = idx === activeSeriesIndex;
            return (
              <button
                key={series.expirationDate}
                onClick={() => onSelectSeriesIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-cyan-500/15 border border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 opacity-70" />
                <span>{series.label}</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                  {series.businessDays} DU
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Strikes Limit */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Strikes Range Selector (±6, ±15, ±30, Todos = ±50 cotações a partir do ATM) */}
          <div className="flex items-center gap-1 bg-[#090e1b] border border-slate-700/80 rounded-lg p-0.5 text-xs font-mono">
            <span className="text-[10px] text-slate-400 px-1.5 uppercase font-semibold">Strikes p/ lado:</span>
            {([6, 15, 30, 50] as const).map((lim) => {
              const isSelected = strikeLimit === lim;
              return (
                <button
                  key={lim}
                  onClick={() => setStrikeLimit(lim)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    isSelected
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(56,189,248,0.3)] font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={lim === 50 ? 'Exibir Todos (±50 cotações para cada lado a partir do ATM)' : `Exibir ${lim} cotações OTM e ${lim} cotações ITM a partir do ATM`}
                >
                  {lim === 50 ? 'Todos (±50)' : `±${lim}`}
                </button>
              );
            })}
          </div>

          {/* Underlying Asset Quick Operations (Comprar / Vender Ativo à Vista) */}
          <div className="flex items-center gap-2 bg-[#090e1b] border border-slate-700/80 rounded-lg px-2 py-1">
            <span className="text-[11px] text-slate-300 font-mono hidden xl:inline">
              À Vista: <strong className="text-white">{underlyingSymbol}</strong> R$ {currentSpot.toFixed(2)}
            </span>
            <button
              onClick={() => onAddAssetLeg('BUY')}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/50 text-[11px] font-mono font-bold transition-all shadow-[0_0_8px_rgba(16,185,129,0.25)] hover:scale-105"
              title={`Comprar 100 cotas/ações de ${underlyingSymbol} a R$ ${currentSpot.toFixed(2)}`}
            >
              <Plus className="w-3 h-3" />
              <span>Comprar {underlyingSymbol}</span>
            </button>
            <button
              onClick={() => onAddAssetLeg('SELL')}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/50 text-[11px] font-mono font-bold transition-all shadow-[0_0_8px_rgba(244,63,94,0.25)] hover:scale-105"
              title={`Vender 100 cotas/ações de ${underlyingSymbol} a R$ ${currentSpot.toFixed(2)}`}
            >
              <Minus className="w-3 h-3" />
              <span>Vender {underlyingSymbol}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-36">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Filtrar strike..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-7 pr-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Column Headers: Calls vs Strike vs Puts - Responsive Scroll Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1fr_80px_1fr] bg-[#070b14] border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {/* Calls Header */}
            <div className="py-2 px-3 text-cyan-400 flex items-center justify-between border-r border-slate-800/60">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]"></span>
                <span>CALLS (Opções de Compra)</span>
              </div>
              <div className="flex items-center gap-2 lg:gap-3 text-[10px] font-mono">
                <span className="w-12 text-right text-slate-500 hidden lg:inline">DELTA</span>
            <span className="w-12 text-right text-slate-500 hidden lg:inline">IV %</span>
            <span className="w-20 text-right text-violet-300 font-bold" title="Preço Teórico Black-Scholes">P. TEÓRICO</span>
            <span className="w-20 text-right text-cyan-300 font-bold" title="Último Negócio registrado na B3">ÚLT. NEG.</span>
          </div>
        </div>

        {/* Center Strike Header */}
        <div className="py-2 text-center text-slate-200 font-mono font-bold bg-[#0a0f1d] tracking-wider">
          STRIKE
        </div>

        {/* Puts Header */}
        <div className="py-2 px-3 text-violet-400 flex items-center justify-between border-l border-slate-800/60">
          <div className="flex items-center gap-2 lg:gap-3 text-[10px] font-mono">
            <span className="w-20 text-left text-cyan-300 font-bold" title="Último Negócio registrado na B3">ÚLT. NEG.</span>
            <span className="w-20 text-left text-violet-300 font-bold" title="Preço Teórico Black-Scholes">P. TEÓRICO</span>
            <span className="w-12 text-left text-slate-500 hidden lg:inline">IV %</span>
            <span className="w-12 text-left text-slate-500 hidden lg:inline">DELTA</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span>PUTS (Opções de Venda)</span>
            <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(168,85,247,0.8)]"></span>
          </div>
        </div>
      </div>

      {/* Options Rows */}
      <div className="overflow-y-auto max-h-[520px] divide-y divide-slate-800/40 text-xs font-mono">
        {filteredStrikes.map((strike) => {
          const item = strikesMap.get(strike);
          const defaultStyle = getAutomaticCallStyle(underlyingSymbol, activeSeries.expirationDate, strike);
          const effectiveStyle = strikeStyleOverrides[strike] || defaultStyle;
          const call = effectiveStyle === 'AMERICANA'
            ? (item?.callAmerican || item?.callEuropean)
            : (item?.callEuropean || item?.callAmerican);
          const put = item?.put;
          const isAtm = strike === atmStrike;
          const isCallItm = strike < currentSpot;
          const isPutItm = strike > currentSpot;

          return (
            <div
              key={strike}
              className={`grid grid-cols-[1fr_80px_1fr] transition-colors hover:bg-slate-800/40 ${
                isAtm ? 'bg-cyan-950/20 ring-1 ring-cyan-500/30' : ''
              }`}
            >
              {/* CALL SIDE */}
              <div
                className={`py-1.5 px-3 flex items-center justify-between border-r border-slate-800/60 ${
                  isCallItm ? 'bg-cyan-950/10' : ''
                }`}
              >
                {/* Actions & Code */}
                <div className="flex items-center gap-1.5">
                  {/* Comprar [+] - Emerald / Green matching asset button */}
                  <button
                    onClick={() => call && onAddLeg(call, 'BUY')}
                    className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/50 transition-all hover:scale-110 shadow-[0_0_6px_rgba(16,185,129,0.2)]"
                    title={`Comprar Call ${call?.code}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {/* Vender [-] - Rose / Red matching asset button */}
                  <button
                    onClick={() => call && onAddLeg(call, 'SELL')}
                    className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/50 transition-all hover:scale-110 shadow-[0_0_6px_rgba(244,63,94,0.2)]"
                    title={`Vender Call ${call?.code}`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <div className="ml-1 flex items-center gap-1.5">
                    {call && (
                      <button
                        type="button"
                        onClick={() => toggleCallStyleForStrike(strike)}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        title={`Estilo ${call.style}. Clique para alternar entre Call Americana [A] e Européia [E].`}
                      >
                        <StyleFlagBadge style={call.style} className="w-5 h-3.5" />
                      </button>
                    )}
                    <span className="font-semibold text-slate-200">{call?.code}</span>
                    {call?.isStale && (
                      <span
                        className="ml-0.5 text-[9px] px-1 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50"
                        title={`Sem negócios há ${call.daysSinceLastTrade} dias. Padrão: Preço Teórico.`}
                      >
                        &gt;7d
                      </span>
                    )}
                  </div>
                </div>

                {/* Call Values Aligned with Header */}
                <div className="flex items-center gap-2 lg:gap-3 tabular-nums text-right font-mono">
                  <span className="w-12 text-slate-400 text-[11px] hidden lg:inline">
                    {call?.delta.toFixed(2)}
                  </span>
                  <span className="w-12 text-slate-400 text-[11px] hidden lg:inline">
                    {(call?.iv ? call.iv * 100 : 0).toFixed(1)}%
                  </span>
                  <span className="w-20 font-semibold text-[11px] text-violet-300">
                    R$ {call?.fairPrice.toFixed(2)}
                  </span>
                  <span className="w-20 font-bold text-[11px] text-cyan-300">
                    R$ {call?.lastPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* CENTER STRIKE */}
              <div
                className={`py-1.5 text-center flex flex-col justify-center items-center font-bold font-mono ${
                  isAtm
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-200 bg-[#090e1b]'
                }`}
              >
                <span>{strike.toFixed(2)}</span>
                {isAtm && (
                  <span className="text-[9px] font-sans text-cyan-400 font-semibold leading-none">
                    ATM
                  </span>
                )}
              </div>

              {/* PUT SIDE */}
              <div
                className={`py-1.5 px-3 flex items-center justify-between border-l border-slate-800/60 ${
                  isPutItm ? 'bg-violet-950/10' : ''
                }`}
              >
                {/* Put Values Aligned with Header */}
                <div className="flex items-center gap-2 lg:gap-3 tabular-nums text-left font-mono">
                  <span className="w-20 font-bold text-[11px] text-cyan-300">
                    R$ {put?.lastPrice.toFixed(2)}
                  </span>
                  <span className="w-20 font-semibold text-[11px] text-violet-300">
                    R$ {put?.fairPrice.toFixed(2)}
                  </span>
                  <span className="w-12 text-slate-400 text-[11px] hidden lg:inline">
                    {(put?.iv ? put.iv * 100 : 0).toFixed(1)}%
                  </span>
                  <span className="w-12 text-slate-400 text-[11px] hidden lg:inline">
                    {put?.delta.toFixed(2)}
                  </span>
                </div>

                {/* Actions & Code */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <div className="mr-1 text-right flex items-center justify-end gap-1.5">
                    {put?.isStale && (
                      <span
                        className="mr-0.5 text-[9px] px-1 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50"
                        title={`Sem negócios há ${put.daysSinceLastTrade} dias. Padrão: Preço Teórico.`}
                      >
                        &gt;7d
                      </span>
                    )}
                    <span className="font-semibold text-slate-200">{put?.code}</span>
                    {put && <StyleFlagBadge style={put.style} className="w-5 h-3.5" />}
                  </div>

                  {/* Comprar [+] - Emerald / Green matching asset button */}
                  <button
                    onClick={() => put && onAddLeg(put, 'BUY')}
                    className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/50 transition-all hover:scale-110 shadow-[0_0_6px_rgba(16,185,129,0.2)]"
                    title={`Comprar Put ${put?.code}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {/* Vender [-] - Rose / Red matching asset button */}
                  <button
                    onClick={() => put && onAddLeg(put, 'SELL')}
                    className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/50 transition-all hover:scale-110 shadow-[0_0_6px_rgba(244,63,94,0.2)]"
                    title={`Vender Put ${put?.code}`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>

      {/* Legend Footer */}
      <div className="p-2 border-t border-slate-800 bg-[#070a14] flex flex-wrap items-center justify-between text-[10px] text-slate-400 px-3 gap-2">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-cyan-950 border border-cyan-800"></span>
            <span>ITM Call</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-violet-950 border border-violet-800"></span>
            <span>ITM Put</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-mono">
              &gt;7d
            </span>
            <span>Sem negócios &gt; 7d (Usa Preço Teórico)</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="flex items-center gap-1.5 text-slate-300" title="Modelo Americano [A]: exercício contínuo a qualquer momento até o vencimento">
              <AmericanFlag className="w-5 h-3.5 inline-block" />
              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-800/80 px-1 py-0.2 rounded leading-none">A</span>
              <span>Americana</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-slate-300" title="Modelo Europeu [E]: exercício exclusivo no vencimento">
              <EuropeanFlag className="w-5 h-3.5 inline-block" />
              <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/80 px-1 py-0.2 rounded leading-none">E</span>
              <span>Européia</span>
            </span>
            <span className="text-slate-400 text-[10px] ml-1">
              (Calls de todos os ativos podem ser dos 2 modelos [A] e [E]; Puts são 100% Européias [E])
            </span>
          </div>
        </div>
        <div className="text-slate-400 font-mono text-[10px] hidden md:block">
          {underlyingSymbol === 'BOVA11' ? (
            <span className="text-cyan-300/90 font-medium">
              BOVA11: Mês {parseInt(activeSeries.expirationDate.split('-')[1], 10) % 2 !== 0 ? 'ímpar' : 'par'} (auto: cot. {parseInt(activeSeries.expirationDate.split('-')[1], 10) % 2 !== 0 ? 'ímpar [A] / par [E]' : 'par [A] / ímpar [E]'}) · Clique no badge [A]/[E] para alternar manualmente
            </span>
          ) : (
            <span>Clique no badge [A]/[E] para alternar manualmente a Call · [+] Comprar · [-] Vender</span>
          )}
        </div>
      </div>
    </div>
  );
};
