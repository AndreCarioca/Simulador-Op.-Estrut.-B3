import React from 'react';
import { Trash2, Plus, Minus, ArrowLeftRight, RefreshCw, AlertTriangle, TrendingUp, ShieldAlert, Award } from 'lucide-react';
import { SimulationLeg, StructureMetrics, PriceReferenceMode } from '../types/options';
import { StyleFlagBadge } from './FlagIcon';

interface StrategyBuilderProps {
  legs: SimulationLeg[];
  metrics: StructureMetrics;
  selectedSymbol: string;
  currentSpot: number;
  onUpdateLeg: (id: string, updates: Partial<SimulationLeg>) => void;
  onRemoveLeg: (id: string) => void;
  onClearLegs: () => void;
  onFlipPositions: () => void;
  onAddAssetLeg: (action: 'BUY' | 'SELL') => void;
}

export const StrategyBuilder: React.FC<StrategyBuilderProps> = ({
  legs,
  metrics,
  selectedSymbol,
  currentSpot,
  onUpdateLeg,
  onRemoveLeg,
  onClearLegs,
  onFlipPositions,
  onAddAssetLeg,
}) => {
  if (legs.length === 0) {
    return (
      <div className="bg-[#0b101d] border border-slate-800/80 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-lg">
        <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
          <TrendingUp className="w-7 h-7 text-cyan-400" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">Nenhuma perna adicionada</h3>
        <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
          Clique nos botões <span className="text-cyan-400 font-bold">[+]</span> ou <span className="text-rose-400 font-bold">[-]</span> na grade de opções acima, ou comece adicionando o ativo à vista abaixo para montar estruturas cobertas (Financiamento, Lançamento Coberto, Collar, etc.).
        </p>

        {/* Quick Add Asset Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onAddAssetLeg('BUY')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/50 text-xs font-mono font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:scale-105"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Comprar {selectedSymbol} (R$ {currentSpot.toFixed(2)})</span>
          </button>
          <button
            onClick={() => onAddAssetLeg('SELL')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/50 text-xs font-mono font-bold transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)] hover:scale-105"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Vender {selectedSymbol} (R$ {currentSpot.toFixed(2)})</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b101d] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg flex flex-col">
      {/* Header with Title and Clear/Flip Controls */}
      <div className="p-3 bg-[#0d1424] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            Simulador de Estrutura ({legs.length} {legs.length === 1 ? 'perna' : 'pernas'})
          </span>
        </div>

        {/* Action Buttons: Add Asset, Flip, Clear */}
        <div className="flex items-center gap-2">
          {/* Quick Add Asset Buttons in Header */}
          <button
            onClick={() => onAddAssetLeg('BUY')}
            className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-semibold transition-all"
            title={`Adicionar compra de 100 ${selectedSymbol} à vista`}
          >
            <Plus className="w-3 h-3" />
            <span>+ {selectedSymbol}</span>
          </button>
          <button
            onClick={() => onAddAssetLeg('SELL')}
            className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-mono font-semibold transition-all"
            title={`Adicionar venda de 100 ${selectedSymbol} à vista`}
          >
            <Minus className="w-3 h-3" />
            <span>- {selectedSymbol}</span>
          </button>

          <button
            onClick={onFlipPositions}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 transition-colors ml-1"
            title="Inverter Compra e Venda de todas as pernas"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Inverter</span>
          </button>
          <button
            onClick={onClearLegs}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-xs font-medium text-rose-300 border border-rose-800/60 transition-colors"
            title="Remover todas as pernas"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>
      </div>

      {/* Legs List */}
      <div className="p-3 divide-y divide-slate-800/60 overflow-x-auto">
        {legs.map((leg, index) => {
          const isBuy = leg.action === 'BUY';
          const isCall = leg.type === 'CALL';

          return (
            <div key={leg.id} className="py-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 text-xs">
              {/* Leg Identifier & Action */}
              <div className="flex items-center gap-2 min-w-[200px]">
                <span className="font-mono text-slate-500 text-[11px] w-4">#{index + 1}</span>

                {/* Buy / Sell Toggle */}
                <button
                  onClick={() => onUpdateLeg(leg.id, { action: isBuy ? 'SELL' : 'BUY' })}
                  className={`px-2.5 py-1 rounded font-bold font-mono text-[11px] transition-all ${
                    isBuy
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                  }`}
                >
                  {isBuy ? 'COMPRA' : 'VENDA'}
                </button>

                {/* Call / Put / Stock Badge */}
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                    leg.isUnderlying || leg.type === 'STOCK'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                      : isCall
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                      : 'bg-violet-950 text-violet-300 border border-violet-800/60'
                  }`}
                >
                  {leg.isUnderlying || leg.type === 'STOCK' ? 'À VISTA' : leg.type}
                </span>

                {/* Option Code & Strike / Stock info */}
                <div>
                  <div className="font-bold font-mono text-white flex items-center gap-1.5">
                    {leg.style && leg.style !== 'N/A' && <StyleFlagBadge style={leg.style} />}
                    <span>{leg.optionCode}</span>
                    {leg.isStale && (
                      <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        &gt;7d
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {leg.isUnderlying || leg.type === 'STOCK' ? (
                      <span>
                        Ativo-Objeto · Spot: <strong className="text-slate-200">R$ {leg.marketLastPrice.toFixed(2)}</strong> (Δ {isBuy ? '+1.0' : '-1.0'})
                      </span>
                    ) : (
                      <span>
                        Strike: <strong className="text-slate-200">R$ {leg.strike.toFixed(2)}</strong> · {leg.expirationDate.split('-').reverse().slice(0, 2).join('/')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity Controls: ETFs allow unit trading (minimum 1), stocks use standard lot 100 */}
              {(() => {
                const isEtf = leg.underlying === 'BOVA11' || leg.underlying === 'SMAL11' || leg.underlying.endsWith('11');
                const minQty = isEtf ? 1 : 100;

                const handleDecrement = () => {
                  if (isEtf) {
                    if (leg.quantity <= 10) {
                      onUpdateLeg(leg.id, { quantity: Math.max(1, leg.quantity - 1) });
                    } else if (leg.quantity <= 100) {
                      onUpdateLeg(leg.id, { quantity: Math.max(1, leg.quantity - 10) });
                    } else {
                      onUpdateLeg(leg.id, { quantity: Math.max(1, leg.quantity - 100) });
                    }
                  } else {
                    onUpdateLeg(leg.id, { quantity: Math.max(100, leg.quantity - 100) });
                  }
                };

                const handleIncrement = () => {
                  if (isEtf) {
                    if (leg.quantity < 10) {
                      onUpdateLeg(leg.id, { quantity: leg.quantity + 1 });
                    } else if (leg.quantity < 100) {
                      onUpdateLeg(leg.id, { quantity: leg.quantity + 10 });
                    } else {
                      onUpdateLeg(leg.id, { quantity: leg.quantity + 100 });
                    }
                  } else {
                    onUpdateLeg(leg.id, { quantity: leg.quantity + 100 });
                  }
                };

                return (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <div className="flex flex-col text-left px-1">
                      <span className="text-[11px] text-slate-400 font-mono leading-none">Qtd:</span>
                      {isEtf && (
                        <span className="text-[9px] text-cyan-400 font-mono leading-none mt-0.5">mín. 1</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleDecrement}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      title={isEtf ? 'Diminuir quantidade (mínimo 1 unidade em ETFs)' : 'Diminuir 100 unidades'}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      step={isEtf ? '1' : '100'}
                      min={minQty}
                      value={leg.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateLeg(leg.id, { quantity: Math.max(minQty, val) });
                        }
                      }}
                      className="w-16 bg-slate-950 border border-slate-700/60 rounded px-1.5 py-0.5 text-center font-mono font-bold text-white text-xs focus:outline-none focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title={isEtf ? `Quantidade da perna (mínimo 1 cota para ${leg.underlying})` : 'Quantidade da perna (múltiplos de 100)'}
                    />
                    <button
                      type="button"
                      onClick={handleIncrement}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      title={isEtf ? 'Aumentar quantidade' : 'Aumentar 100 unidades'}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                );
              })()}

              {/* Price Reference Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">Preço:</span>
                {leg.isUnderlying || leg.type === 'STOCK' ? (
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => onUpdateLeg(leg.id, { priceMode: 'LAST', entryPrice: leg.marketLastPrice })}
                      className="px-2.5 py-1 rounded text-[11px] font-mono text-cyan-300 hover:bg-slate-800 transition-all font-semibold"
                      title="Usar preço de mercado à vista atual"
                    >
                      Spot R$ {leg.marketLastPrice.toFixed(2)}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => onUpdateLeg(leg.id, { priceMode: 'FAIR', entryPrice: leg.fairPrice })}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                        leg.priceMode === 'FAIR'
                          ? 'bg-violet-600 text-white font-bold shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Preço Teórico Black-Scholes (padrão - ajusta dinamicamente com a cotação do ativo)"
                    >
                      Teórico R$ {leg.fairPrice.toFixed(2)}
                    </button>
                    <button
                      onClick={() => onUpdateLeg(leg.id, { priceMode: 'LAST', entryPrice: leg.marketLastPrice })}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                        leg.priceMode === 'LAST'
                          ? 'bg-cyan-600 text-white font-bold shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Preço do último negócio registrado na B3"
                    >
                      Último R$ {leg.marketLastPrice.toFixed(2)}
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 font-mono">
                  <span className="text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={leg.entryPrice}
                    onChange={(e) =>
                      onUpdateLeg(leg.id, {
                        priceMode: 'CUSTOM',
                        entryPrice: Math.max(0.01, parseFloat(e.target.value) || 0.01),
                      })
                    }
                    className="w-18 bg-slate-950 border border-slate-700/60 rounded px-1.5 py-1 text-right font-mono font-bold text-white text-xs focus:outline-none focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Total Financial for Leg */}
              <div className="text-right font-mono min-w-[100px]">
                <div className="text-[10px] text-slate-500">Total Perna</div>
                <div className={`font-bold ${isBuy ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isBuy ? '-' : '+'} R$ {(leg.entryPrice * leg.quantity).toFixed(2)}
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => onRemoveLeg(leg.id)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                title="Remover perna"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Structure Summary & Risk Metrics Grid */}
      <div className="p-4 bg-[#080d1a] border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Custo / Crédito Líquido */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 mb-0.5">Montagem Líquida</div>
          <div
            className={`font-mono text-sm font-bold tabular-nums ${
              metrics.isCredit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {metrics.isCredit ? 'Crédito ' : 'Débito '}
            R$ {Math.abs(metrics.totalCost).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.isCredit ? 'Recebido na conta' : 'Custo pago na entrada'}
          </div>
        </div>

        {/* Metric 2: Lucro Máximo */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 mb-0.5">Lucro Máximo</div>
          <div className="font-mono text-sm font-bold text-emerald-400 tabular-nums flex items-baseline flex-wrap gap-1">
            {metrics.maxProfit === 'ILIMITADO' ? (
              <span>ILIMITADO</span>
            ) : (
              <>
                <span>R$ {metrics.maxProfit.toFixed(2)}</span>
                {metrics.maxProfitPercent !== undefined && (
                  <span className="text-xs text-emerald-300 font-bold">
                    (+{metrics.maxProfitPercent.toFixed(1)}%)
                  </span>
                )}
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.maxProfitPercent !== undefined ? 'Retorno sobre montagem' : 'Potencial de ganho'}
          </div>
        </div>

        {/* Metric 3: Prejuízo Máximo */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 mb-0.5">Prejuízo Máximo</div>
          <div className="font-mono text-sm font-bold text-rose-400 tabular-nums flex items-baseline flex-wrap gap-1">
            {metrics.maxLoss === 'ILIMITADO' ? (
              <span>ILIMITADO (Risco Aberto)</span>
            ) : (
              <>
                <span>R$ {metrics.maxLoss.toFixed(2)}</span>
                {metrics.maxLossPercent !== undefined && (
                  <span className="text-xs text-rose-300 font-bold">
                    (-{metrics.maxLossPercent.toFixed(1)}%)
                  </span>
                )}
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.maxLoss === 'ILIMITADO' ? 'Risco aberto na alta' : 'Perda máx. (ativo até R$ 0,00)'}
          </div>
        </div>

        {/* Metric 4: Breakevens */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 mb-0.5">Breakeven(s)</div>
          <div className="font-mono text-xs font-bold text-cyan-300 tabular-nums truncate">
            {metrics.breakevens.length > 0
              ? metrics.breakevens.map((b) => `R$ ${b.toFixed(2)}`).join(' | ')
              : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500">Preço de equilíbrio</div>
        </div>

        {/* Metric 5: Probabilidade de Lucro (PoP) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 mb-0.5">Prob. Lucro (PoP)</div>
          <div className="font-mono text-sm font-bold text-violet-300 tabular-nums">
            {metrics.pop.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">Black-Scholes Integral</div>
        </div>

        {/* Metric 6: Delta, Theta & Rho Totais */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 mb-0.5">Gregas Líquidas</div>
          <div className="font-mono text-xs font-bold text-slate-200 tabular-nums flex items-center justify-between">
            <span>Δ: {metrics.totalDelta.toFixed(1)}</span>
            <span className={metrics.totalTheta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              Θ: R$ {metrics.totalTheta.toFixed(1)}/d
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between mt-0.5">
            <span>V: {metrics.totalVega.toFixed(1)}</span>
            <span className="text-violet-300 font-medium">Rho: R$ {metrics.totalRho.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
