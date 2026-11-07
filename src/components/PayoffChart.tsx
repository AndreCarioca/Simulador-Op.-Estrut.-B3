import React, { useState, useRef, useMemo } from 'react';
import { generatePayoffCurve } from '../utils/blackScholes';
import { SimulationLeg, StructureMetrics } from '../types/options';
import { Sliders, RefreshCw, Eye, TrendingUp, Info } from 'lucide-react';

interface PayoffChartProps {
  legs: SimulationLeg[];
  currentSpot: number;
  metrics: StructureMetrics;
  riskFreeRate?: number;
}

export const PayoffChart: React.FC<PayoffChartProps> = ({ legs, currentSpot, metrics, riskFreeRate }) => {
  // Interactive sensitivity sliders
  const [spotPriceShift, setSpotPriceShift] = useState<number>(0); // -20% to +20%
  const [volShockPercent, setVolShockPercent] = useState<number>(0); // -10% to +10%

  // Days left slider (default to max days among option legs)
  const maxLegDays = useMemo(() => {
    if (legs.length === 0) return 30;
    const optionLegs = legs.filter((l) => !l.isUnderlying && l.type !== 'STOCK');
    if (optionLegs.length === 0) return 30;
    return Math.max(...optionLegs.map((l) => l.daysToExpiration));
  }, [legs]);

  const [daysLeftSim, setDaysLeftSim] = useState<number>(maxLegDays);

  // Mouse hover state for crosshair
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulated spot
  const simulatedSpot = Number((currentSpot * (1 + spotPriceShift / 100)).toFixed(2));

  // Generate curve points
  const points = useMemo(() => {
    if (legs.length === 0) return [];
    return generatePayoffCurve(
      legs,
      currentSpot,
      daysLeftSim,
      volShockPercent / 100,
      80,
      riskFreeRate
    );
  }, [legs, currentSpot, daysLeftSim, volShockPercent, riskFreeRate]);

  // If no legs, return placeholder
  if (legs.length === 0 || points.length === 0) {
    return (
      <div className="bg-[#0b101d] border border-slate-800/80 rounded-xl p-8 flex flex-col items-center justify-center text-center h-[380px] shadow-lg">
        <TrendingUp className="w-10 h-10 text-slate-600 mb-2" />
        <h4 className="text-sm font-semibold text-slate-300">Gráfico de Payoff Aguardando Pernas</h4>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Adicione uma ou mais opções na grade acima para desenhar o gráfico interativo de risco, retorno e gregas no vencimento e hoje.
        </p>
      </div>
    );
  }

  // Calculate chart boundaries
  const prices = points.map((p) => p.spotPrice);
  const minX = Math.min(...prices);
  const maxX = Math.max(...prices);

  const allPnls = points.flatMap((p) => [p.payoffAtExpiry, p.payoffToday]);
  const rawMinY = Math.min(...allPnls);
  const rawMaxY = Math.max(...allPnls);

  // Add 15% margin to Y axis
  const yPadding = Math.max((rawMaxY - rawMinY) * 0.15, 100);
  const minY = rawMinY - yPadding;
  const maxY = rawMaxY + yPadding;

  // Chart dimensions
  const width = 800;
  const height = 340;
  const padLeft = 65;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const scaleX = (val: number) => padLeft + ((val - minX) / (maxX - minX)) * chartW;
  const scaleY = (val: number) => padTop + chartH - ((val - minY) / (maxY - minY)) * chartH;

  const zeroY = scaleY(0);
  const currentSpotX = scaleX(simulatedSpot);

  // SVG Paths
  const expiryPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.spotPrice).toFixed(1)} ${scaleY(p.payoffAtExpiry).toFixed(1)}`)
    .join(' ');

  const todayPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.spotPrice).toFixed(1)} ${scaleY(p.payoffToday).toFixed(1)}`)
    .join(' ');

  // Area under/above zero for expiration
  const expiryAreaPath = `${expiryPath} L ${scaleX(points[points.length - 1].spotPrice)} ${zeroY} L ${scaleX(
    points[0].spotPrice
  )} ${zeroY} Z`;

  // Hover point
  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    if (svgX < padLeft || svgX > width - padRight) {
      setHoverIndex(null);
      return;
    }

    const ratio = (svgX - padLeft) / chartW;
    const index = Math.round(ratio * (points.length - 1));
    if (index >= 0 && index < points.length) {
      setHoverIndex(index);
    }
  };

  return (
    <div className="bg-[#0b101d] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg flex flex-col">
      {/* Top Bar with Legend and Title */}
      <div className="p-3 bg-[#0d1424] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">Gráfico de Payoff Interativo</span>
          <span className="text-xs text-slate-400 hidden sm:inline">| Simulação de Resultado (R$)</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
            <span className="text-slate-300">No Vencimento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]"></span>
            <span className="text-cyan-300">Hoje / T+{daysLeftSim}d</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.9)]"></span>
            <span className="text-yellow-300 font-semibold">Linha Zero (P&L 0)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            <span className="text-slate-400">Breakeven</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart Canvas */}
      <div className="relative p-2 bg-[#090e1a]" ref={containerRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lossGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[-1000, -500, 500, 1000, 2000].map((val) => {
            if (val < minY || val > maxY) return null;
            const y = scaleY(val);
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  R$ {val}
                </text>
              </g>
            );
          })}

          {/* Soft Profit & Loss Zone Labels */}
          {zeroY - 24 > padTop && (
            <text
              x={padLeft + 10}
              y={Math.max(padTop + 14, zeroY - 10)}
              fill="#10b981"
              fillOpacity="0.3"
              fontSize="9"
              fontWeight="bold"
              fontFamily="monospace"
              letterSpacing="0.8"
            >
              ▲ REGIÃO DE LUCRO
            </text>
          )}
          {zeroY + 24 < height - padBottom && (
            <text
              x={padLeft + 10}
              y={Math.min(height - padBottom - 8, zeroY + 18)}
              fill="#f43f5e"
              fillOpacity="0.3"
              fontSize="9"
              fontWeight="bold"
              fontFamily="monospace"
              letterSpacing="0.8"
            >
              ▼ REGIÃO DE PREJUÍZO
            </text>
          )}

          {/* Zero Line Highlight - Neon Yellow Soft Dashed */}
          <line
            x1={padLeft}
            y1={zeroY}
            x2={width - padRight}
            y2={zeroY}
            stroke="#facc15"
            strokeWidth="1.8"
            strokeDasharray="6 4"
            strokeOpacity="0.9"
            className="drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]"
          />
          {/* Zero Line Left Axis Text in Neon Yellow */}
          <text
            x={padLeft - 8}
            y={zeroY + 4}
            textAnchor="end"
            fill="#facc15"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
            className="drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]"
          >
            R$ 0
          </text>
          {/* Zero Line Right Indicator */}
          <text
            x={width - padRight - 6}
            y={zeroY - 5}
            textAnchor="end"
            fill="#fef08a"
            fontSize="9"
            fontWeight="bold"
            fontFamily="monospace"
            className="drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]"
          >
            P&L R$ 0,00
          </text>

          {/* Breakeven Vertical Markers */}
          {metrics.breakevens.map((be) => {
            if (be < minX || be > maxX) return null;
            const x = scaleX(be);
            return (
              <g key={be}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={height - padBottom}
                  stroke="#eab308"
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />
                <circle cx={x} cy={zeroY} r="4" fill="#eab308" className="shadow-lg" />
                <text
                  x={x}
                  y={height - padBottom + 14}
                  textAnchor="middle"
                  fill="#facc15"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  BE {be.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Spot Price Line */}
          <line
            x1={currentSpotX}
            y1={padTop}
            x2={currentSpotX}
            y2={height - padBottom}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
          <text
            x={currentSpotX}
            y={padTop - 8}
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
          >
            Spot R$ {simulatedSpot.toFixed(2)}
          </text>

          {/* Curves */}
          {/* Expiration Curve */}
          <path
            d={expiryPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          />

          {/* Today / T+Eval Curve */}
          <path
            d={todayPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 3"
            className="drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
          />

          {/* X Axis Ticks */}
          {prices.filter((_, idx) => idx % 10 === 0).map((price) => {
            const x = scaleX(price);
            return (
              <text
                key={price}
                x={x}
                y={height - padBottom + 28}
                textAnchor="middle"
                fill="#64748b"
                fontSize="10"
                fontFamily="monospace"
              >
                {price.toFixed(1)}
              </text>
            );
          })}

          {/* Hover Tracker Pin */}
          {activePoint && (
            <g>
              <line
                x1={scaleX(activePoint.spotPrice)}
                y1={padTop}
                x2={scaleX(activePoint.spotPrice)}
                y2={height - padBottom}
                stroke="#a855f7"
                strokeWidth="1"
              />
              <circle
                cx={scaleX(activePoint.spotPrice)}
                cy={scaleY(activePoint.payoffAtExpiry)}
                r="5"
                fill="#10b981"
                stroke="#fff"
                strokeWidth="1.5"
              />
              <circle
                cx={scaleX(activePoint.spotPrice)}
                cy={scaleY(activePoint.payoffToday)}
                r="4"
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Hover Floating Details Card */}
        {activePoint && (() => {
          // Variação percentual do ponto simulado em relação ao preço spot
          const spotDiffPercent = currentSpot > 0
            ? ((activePoint.spotPrice - currentSpot) / currentSpot) * 100
            : 0;

          // Capital base de montagem para retorno percentual
          const capitalBase =
            metrics.capitalBase && metrics.capitalBase > 0
              ? metrics.capitalBase
              : metrics.totalCost > 0
              ? metrics.totalCost
              : typeof metrics.maxLoss === 'number' && metrics.maxLoss > 0
              ? metrics.maxLoss
              : Math.abs(metrics.totalCost) > 0
              ? Math.abs(metrics.totalCost)
              : currentSpot * 100;

          const expiryReturnPct = capitalBase > 0
            ? (activePoint.payoffAtExpiry / capitalBase) * 100
            : 0;
          const todayReturnPct = capitalBase > 0
            ? (activePoint.payoffToday / capitalBase) * 100
            : 0;

          return (
            <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 text-xs font-mono shadow-2xl backdrop-blur-md pointer-events-none z-10 min-w-[250px]">
              <div className="text-slate-400 text-[11px] pb-1.5 border-b border-slate-800 flex items-center justify-between">
                <span>Ponto Simulado:</span>
                <span className="tabular-nums">
                  <strong className="text-white text-xs">R$ {activePoint.spotPrice.toFixed(2)}</strong>{' '}
                  <span
                    className={`font-bold ml-1 ${
                      spotDiffPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    ({spotDiffPercent >= 0 ? '+' : ''}{spotDiffPercent.toFixed(2)}%)
                  </span>
                </span>
              </div>
              <div className="pt-2 space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-emerald-400">P&L Vencimento:</span>
                  <div className="text-right tabular-nums">
                    <strong className={activePoint.payoffAtExpiry >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {activePoint.payoffAtExpiry >= 0 ? '+' : ''} R$ {activePoint.payoffAtExpiry.toFixed(2)}
                    </strong>
                    <span
                      className={`text-[10px] ml-1.5 font-bold ${
                        activePoint.payoffAtExpiry >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'
                      }`}
                    >
                      ({activePoint.payoffAtExpiry >= 0 ? '+' : ''}{expiryReturnPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-cyan-400">P&L Hoje (T+{daysLeftSim}d):</span>
                  <div className="text-right tabular-nums">
                    <strong className={activePoint.payoffToday >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {activePoint.payoffToday >= 0 ? '+' : ''} R$ {activePoint.payoffToday.toFixed(2)}
                    </strong>
                    <span
                      className={`text-[10px] ml-1.5 font-bold ${
                        activePoint.payoffToday >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'
                      }`}
                    >
                      ({activePoint.payoffToday >= 0 ? '+' : ''}{todayReturnPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                  <span>Delta Posição:</span>
                  <span className="font-bold text-slate-300">{activePoint.delta.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Theta Diário:</span>
                  <span className={activePoint.theta >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    R$ {activePoint.theta.toFixed(1)}/d
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Interactive Simulation Sliders */}
      <div className="p-3 bg-[#0a0f1d] border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        {/* Slider 1: Preço do Ativo Spot Shift */}
        <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
            <span className="flex items-center gap-1 text-cyan-300">
              <Sliders className="w-3 h-3" /> Preço do Ativo
            </span>
            <span className="font-bold text-white tabular-nums">
              R$ {simulatedSpot.toFixed(2)} ({spotPriceShift >= 0 ? '+' : ''}{spotPriceShift}%)
            </span>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            value={spotPriceShift}
            onChange={(e) => setSpotPriceShift(parseInt(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>-20%</span>
            <button
              onClick={() => setSpotPriceShift(0)}
              className="hover:text-cyan-300 transition-colors underline"
            >
              Reset Spot
            </button>
            <span>+20%</span>
          </div>
        </div>

        {/* Slider 2: Passagem do Tempo (Theta Decay) */}
        <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
            <span className="flex items-center gap-1 text-violet-300">
              <Sliders className="w-3 h-3" /> Dias para Vencimento
            </span>
            <span className="font-bold text-white tabular-nums">
              T+{daysLeftSim} dias
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={maxLegDays}
            step="1"
            value={daysLeftSim}
            onChange={(e) => setDaysLeftSim(parseInt(e.target.value))}
            className="w-full accent-violet-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>0d (Vencimento)</span>
            <button
              onClick={() => setDaysLeftSim(maxLegDays)}
              className="hover:text-violet-300 transition-colors underline"
            >
              Hoje ({maxLegDays}d)
            </button>
            <span>{maxLegDays}d</span>
          </div>
        </div>

        {/* Slider 3: Choque de Volatilidade (Vega Shift) */}
        <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-lg">
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
            <span className="flex items-center gap-1 text-emerald-300">
              <Sliders className="w-3 h-3" /> Choque de Volatilidade (IV)
            </span>
            <span className="font-bold text-white tabular-nums">
              {volShockPercent >= 0 ? '+' : ''}{volShockPercent} pp
            </span>
          </div>
          <input
            type="range"
            min="-10"
            max="10"
            step="1"
            value={volShockPercent}
            onChange={(e) => setVolShockPercent(parseInt(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>-10%</span>
            <button
              onClick={() => setVolShockPercent(0)}
              className="hover:text-emerald-300 transition-colors underline"
            >
              Vol Padrão
            </button>
            <span>+10%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
