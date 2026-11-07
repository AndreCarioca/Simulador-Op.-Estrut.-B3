import React, { useState } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight, Activity, ShieldCheck, HelpCircle, Plus, Minus, RotateCcw, Percent } from 'lucide-react';
import { UnderlyingAsset } from '../types/options';

interface HeaderProps {
  underlyings: UnderlyingAsset[];
  selectedSymbol: string;
  interestRate: number;
  defaultInterestRate: number;
  isSyncingB3?: boolean;
  lastSyncTime?: string;
  onSelectSymbol: (symbol: string) => void;
  onUpdateSpotPrice: (newPrice: number) => void;
  onUpdateInterestRate: (newRate: number) => void;
  onResetToOfficialClose: () => void;
  onResetInterestRate: () => void;
  onManualRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  underlyings,
  selectedSymbol,
  interestRate,
  defaultInterestRate,
  isSyncingB3 = false,
  lastSyncTime,
  onSelectSymbol,
  onUpdateSpotPrice,
  onUpdateInterestRate,
  onResetToOfficialClose,
  onResetInterestRate,
  onManualRefresh,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const currentAsset = underlyings.find((a) => a.symbol === selectedSymbol) || underlyings[0];
  const isPositive = currentAsset.change >= 0;
  const isModifiedFromClose = Math.abs(currentAsset.currentPrice - currentAsset.previousClose) > 0.001;

  return (
    <header className="border-b border-slate-800/80 bg-[#080d1a]/95 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-6 py-2.5">
      <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Zone 1: Wordmark & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-violet-600 to-emerald-500 p-[1.5px] shadow-[0_0_15px_rgba(56,189,248,0.3)]">
            <div className="w-full h-full bg-[#080d1a] rounded-[7px] flex items-center justify-center">
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wider text-white">
                B3 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400">OPÇÕES</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/50 text-cyan-300">
                Neon Sim
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Simulador de Derivativos · Preço Teórico & Gregas</div>
          </div>
        </div>

        {/* Zone 2: Asset Switcher, Editable Quote & Controls */}
        <div className="flex flex-wrap items-center gap-3 lg:gap-5">
          {/* Asset Select */}
          <div className="flex items-center gap-2">
            <label htmlFor="asset-select" className="text-xs text-slate-400 font-medium">Ativo:</label>
            <select
              id="asset-select"
              value={selectedSymbol}
              onChange={(e) => onSelectSymbol(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors cursor-pointer"
            >
              {underlyings.map((asset) => (
                <option key={asset.symbol} value={asset.symbol} className="bg-slate-900 text-white">
                  {asset.symbol} - {asset.name.split(' ')[0]} ({asset.type})
                </option>
              ))}
            </select>
          </div>

          {/* User-Adjustable Spot Quote Input Box */}
          <div className="flex items-center gap-2 bg-[#0a0f1e] border border-cyan-500/40 rounded-xl px-2.5 py-1 shadow-[0_0_12px_rgba(56,189,248,0.15)]">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono font-semibold hidden sm:inline">À Vista:</span>
              <span className="text-xs text-cyan-400 font-bold font-mono">R$</span>
              
              {/* Stepper Down */}
              <button
                type="button"
                onClick={() => onUpdateSpotPrice(Math.max(0.01, Number((currentAsset.currentPrice - 0.50).toFixed(2))))}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Diminuir R$ 0,50 no preço do ativo"
              >
                <Minus className="w-3 h-3" />
              </button>

              {/* Editable Numeric Field */}
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={currentAsset.currentPrice}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    onUpdateSpotPrice(Number(val.toFixed(2)));
                  }
                }}
                className="w-20 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-1.5 py-0.5 text-center font-mono font-bold text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-[inset_0_0_6px_rgba(56,189,248,0.2)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Edite a cotação do ativo: o Preço Teórico das opções e as Gregas se ajustarão dinamicamente em tempo real"
              />

              {/* Stepper Up */}
              <button
                type="button"
                onClick={() => onUpdateSpotPrice(Number((currentAsset.currentPrice + 0.50).toFixed(2)))}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Aumentar R$ 0,50 no preço do ativo"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Percentage Change vs Official B3 Close */}
            <div className="border-l border-slate-800 pl-2 flex flex-col justify-center">
              <span
                className={`flex items-center text-xs font-mono font-bold tabular-nums ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                {isPositive ? '+' : ''}
                {currentAsset.changePercent.toFixed(2)}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono leading-none">
                Fech. R$ {currentAsset.previousClose.toFixed(2)}
              </span>
            </div>

            {/* Reset to Official B3 Close Button */}
            {isModifiedFromClose && (
              <button
                type="button"
                onClick={onResetToOfficialClose}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 text-[10px] transition-colors ml-1"
                title="Restaurar cotação oficial do fechamento da B3"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* User-Adjustable Interest Rate (Selic/DI) Input Box */}
          <div className="flex items-center gap-1.5 bg-[#0a0f1e] border border-violet-500/40 rounded-xl px-2.5 py-1 shadow-[0_0_12px_rgba(168,85,247,0.15)] shrink-0">
            <div className="flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-[11px] text-slate-400 font-mono font-semibold hidden sm:inline">Juros (DI):</span>
              
              {/* Stepper Down (-0.25%) */}
              <button
                type="button"
                onClick={() => onUpdateInterestRate(Math.max(0, Number((interestRate - 0.25).toFixed(2))))}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Diminuir 0,25% a.a. na taxa de juros"
              >
                <Minus className="w-3 h-3" />
              </button>

              {/* Editable Numeric Field */}
              <input
                type="number"
                step="0.25"
                min="0"
                max="100"
                value={interestRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) {
                    onUpdateInterestRate(Number(val.toFixed(2)));
                  }
                }}
                className="w-16 bg-slate-950 border border-slate-700 focus:border-violet-400 rounded px-1.5 py-0.5 text-center font-mono font-bold text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400 shadow-[inset_0_0_6px_rgba(168,85,247,0.2)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Taxa de juros anual (Selic/DI): altere para recalcular o Preço Teórico e as Gregas em tempo real"
              />

              {/* Stepper Up (+0.25%) */}
              <button
                type="button"
                onClick={() => onUpdateInterestRate(Number((interestRate + 0.25).toFixed(2)))}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Aumentar 0,25% a.a. na taxa de juros"
              >
                <Plus className="w-3 h-3" />
              </button>

              <span className="text-xs text-violet-300 font-mono font-bold">% a.a.</span>
            </div>

            {/* Reset to Default Rate Button */}
            {Math.abs(interestRate - defaultInterestRate) > 0.001 && (
              <button
                type="button"
                onClick={onResetInterestRate}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-violet-300 border border-slate-700 text-[10px] transition-colors ml-0.5"
                title={`Restaurar taxa padrão (${defaultInterestRate.toFixed(2).replace('.', ',')}% a.a.)`}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Manual Reload B3 Official Bulletin Button */}
          <button
            onClick={onManualRefresh}
            disabled={isSyncingB3}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              isSyncingB3
                ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800/60 cursor-wait'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-800 hover:border-cyan-500/40'
            }`}
            title="Consultar dados mais recentes no Hub da B3 / Brapi e atualizar todas as cotações"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingB3 ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">
              {isSyncingB3 ? 'Consultando B3...' : 'Atualizar B3'}
            </span>
          </button>

          {/* Sync status badge */}
          {lastSyncTime && (
            <span
              className="hidden xl:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300"
              title="Última sincronização bem-sucedida com o Hub da B3"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {lastSyncTime}
            </span>
          )}
        </div>

        {/* Zone 3: B3 Info & Rules Tooltip */}
        <div className="flex items-center gap-2 relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-colors"
            title="Regras B3 e funcionamento da precificação dinâmica"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-mono hidden sm:inline">Regras B3</span>
          </button>

          {showTooltip && (
            <div className="absolute right-0 top-11 w-96 p-3.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-2xl z-50">
              <div className="font-semibold text-white mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Regras de Exercício B3 & Cotação Interativa
              </div>
              <div className="space-y-2 text-[11px] leading-relaxed text-slate-300">
                <p>
                  <strong className="text-white">Simulação Dinâmica:</strong> Os valores são carregados na inicialização da B3. Você pode ajustar a cotação do ativo na caixa acima para ver o <strong className="text-violet-300">Preço Teórico (Black-Scholes)</strong> e as Gregas recalculando em tempo real.
                </p>
                <div className="bg-slate-950/70 p-2 rounded border border-slate-800 space-y-1 font-mono text-[10px]">
                  <div>
                    <span className="text-amber-300 font-bold">🇺🇸 Americana [A]:</span> Calls de ações (exercício a qualquer momento até o vencimento).
                  </div>
                  <div>
                    <span className="text-cyan-300 font-bold">🇪🇺 Européia [E]:</span> Puts de ações e todas as opções de ETFs (BOVA11, SMAL11) (exercício apenas no vencimento).
                  </div>
                </div>
                <p className="text-slate-400">
                  <strong className="text-slate-200">Preço de Referência:</strong> Por padrão, a simulação utiliza o Preço Teórico calculado, ajustando-se instantaneamente às suas alterações do ativo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
