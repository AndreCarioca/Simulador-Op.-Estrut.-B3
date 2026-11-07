import React, { useState, useMemo } from 'react';
import { SimulationLeg, StructureMetrics } from '../types/options';
import { generatePayoffCurve } from '../utils/blackScholes';
import { Activity, Shield, Clock, Zap, BarChart3, HelpCircle } from 'lucide-react';

interface GreeksVisualizerProps {
  legs: SimulationLeg[];
  currentSpot: number;
  metrics: StructureMetrics;
  riskFreeRate?: number;
}

type SelectedGreek = 'delta' | 'gamma' | 'theta' | 'vega';

export const GreeksVisualizer: React.FC<GreeksVisualizerProps> = ({ legs, currentSpot, metrics, riskFreeRate }) => {
  const [activeGreek, setActiveGreek] = useState<SelectedGreek>('delta');

  // Generate curve points across spot prices
  const points = useMemo(() => {
    if (legs.length === 0) return [];
    return generatePayoffCurve(legs, currentSpot, undefined, 0, 60, riskFreeRate);
  }, [legs, currentSpot, riskFreeRate]);

  if (legs.length === 0 || points.length === 0) {
    return null;
  }

  // Chart dimensions
  const width = 800;
  const height = 220;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const prices = points.map((p) => p.spotPrice);
  const minX = Math.min(...prices);
  const maxX = Math.max(...prices);

  const values = points.map((p) => p[activeGreek]);
  const rawMinY = Math.min(...values);
  const rawMaxY = Math.max(...values);

  // Y bounds with padding
  const yPadding = Math.max((rawMaxY - rawMinY) * 0.2, 0.5);
  const minY = rawMinY - yPadding;
  const maxY = rawMaxY + yPadding;

  const scaleX = (val: number) => padLeft + ((val - minX) / (maxX - minX)) * chartW;
  const scaleY = (val: number) => padTop + chartH - ((val - minY) / (maxY - minY)) * chartH;

  const zeroY = scaleY(0);
  const currentSpotX = scaleX(currentSpot);

  const greekPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.spotPrice).toFixed(1)} ${scaleY(p[activeGreek]).toFixed(1)}`)
    .join(' ');

  const getGreekColor = (g: SelectedGreek) => {
    switch (g) {
      case 'delta':
        return '#38bdf8'; // Cyan
      case 'gamma':
        return '#f59e0b'; // Amber
      case 'theta':
        return '#10b981'; // Emerald
      case 'vega':
        return '#a855f7'; // Violet
    }
  };

  const activeColor = getGreekColor(activeGreek);

  const greekInfo: Record<SelectedGreek, { label: string; unit: string; description: string }> = {
    delta: {
      label: 'Delta (Δ)',
      unit: 'Ações equivalentes',
      description: 'Mede a sensibilidade do valor da estrutura para cada R$ 1,00 de oscilação no ativo-objeto.',
    },
    gamma: {
      label: 'Gamma (Γ)',
      unit: 'Δ por R$ 1,00',
      description: 'Taxa de variação do Delta. Indica a aceleração direcional e o risco de desbalanceamento.',
    },
    theta: {
      label: 'Theta (Θ)',
      unit: 'R$ / dia corrido',
      description: 'Decaimento financeiro diário devido à passagem do tempo. Positivo ganha dinheiro com o tempo.',
    },
    vega: {
      label: 'Vega (V)',
      unit: 'R$ / 1% de Vol',
      description: 'Sensibilidade financeira da estrutura para cada 1 ponto percentual (1%) de alteração na volatilidade implícita.',
    },
  };

  return (
    <div className="bg-[#0b101d] border border-slate-800/80 rounded-xl overflow-hidden shadow-lg flex flex-col">
      {/* Header and Greek Selector Tabs */}
      <div className="p-3 bg-[#0d1424] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-sm text-white">Curvas de Gregas da Estrutura</span>
        </div>

        {/* Tabs for Greeks */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs font-mono">
          {(['delta', 'gamma', 'theta', 'vega'] as SelectedGreek[]).map((greek) => {
            const isActive = activeGreek === greek;
            const color = getGreekColor(greek);
            return (
              <button
                key={greek}
                onClick={() => setActiveGreek(greek)}
                className={`px-3 py-1 rounded-md capitalize font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ color: isActive ? color : undefined }}
              >
                {greek}
              </button>
            );
          })}
        </div>
      </div>

      {/* Greek Explanation Banner */}
      <div className="px-4 py-2 bg-[#090e1a] border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{greekInfo[activeGreek].label}:</span>
          <span className="text-slate-400">{greekInfo[activeGreek].description}</span>
        </div>
        <div className="text-slate-300 font-bold shrink-0">
          Unidade: <span className="text-cyan-300">{greekInfo[activeGreek].unit}</span>
        </div>
      </div>

      {/* SVG Greek Curve */}
      <div className="p-2 bg-[#080c17]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
          {/* Zero Line */}
          {minY < 0 && maxY > 0 && (
            <line
              x1={padLeft}
              y1={zeroY}
              x2={width - padRight}
              y2={zeroY}
              stroke="#475569"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Current Spot Vertical Line */}
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
            y={padTop - 4}
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="9"
            fontWeight="bold"
            fontFamily="monospace"
          >
            Spot Atual R$ {currentSpot.toFixed(2)}
          </text>

          {/* Greek Curve Path */}
          <path
            d={greekPath}
            fill="none"
            stroke={activeColor}
            strokeWidth="2.5"
            className="drop-shadow-[0_0_10px_rgba(56,189,248,0.4)]"
          />

          {/* Y Axis Reference Labels */}
          {[minY, (minY + maxY) / 2, maxY].map((val, idx) => {
            const y = scaleY(val);
            return (
              <text
                key={idx}
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize="9"
                fontFamily="monospace"
              >
                {val.toFixed(2)}
              </text>
            );
          })}

          {/* X Axis Reference Labels */}
          {prices.filter((_, idx) => idx % 10 === 0).map((price) => {
            const x = scaleX(price);
            return (
              <text
                key={price}
                x={x}
                y={height - padBottom + 18}
                textAnchor="middle"
                fill="#64748b"
                fontSize="9"
                fontFamily="monospace"
              >
                {price.toFixed(1)}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Per-Leg Greek Contribution Breakdown Table */}
      <div className="p-3 bg-[#0a0f1d] border-t border-slate-800/80">
        <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
          Composição das Gregas por Perna
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px]">
                <th className="pb-1">Ativo / Opção</th>
                <th className="pb-1">Ação</th>
                <th className="pb-1 text-right">Qtd</th>
                <th className="pb-1 text-right">Delta Indiv.</th>
                <th className="pb-1 text-right text-cyan-300">Delta Total</th>
                <th className="pb-1 text-right">Gamma</th>
                <th className="pb-1 text-right text-emerald-400">Theta (R$/dia)</th>
                <th className="pb-1 text-right text-violet-300">Vega (R$/1%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {legs.map((leg) => {
                const mult = leg.action === 'BUY' ? 1 : -1;
                const legTotalDelta = mult * leg.delta * leg.quantity;
                const legTotalGamma = mult * leg.gamma * leg.quantity;
                const legTotalTheta = mult * leg.theta * leg.quantity;
                const legTotalVega = mult * leg.vega * leg.quantity;

                return (
                  <tr key={leg.id} className="hover:bg-slate-800/30">
                    <td className="py-1 font-bold text-white">{leg.optionCode}</td>
                    <td className="py-1">
                      <span className={leg.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                        {leg.action}
                      </span>
                    </td>
                    <td className="py-1 text-right text-slate-300">{leg.quantity}</td>
                    <td className="py-1 text-right text-slate-400">{leg.delta.toFixed(2)}</td>
                    <td className="py-1 text-right font-bold text-cyan-300">{legTotalDelta.toFixed(1)}</td>
                    <td className="py-1 text-right text-slate-300">{legTotalGamma.toFixed(4)}</td>
                    <td className={`py-1 text-right font-bold ${legTotalTheta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {legTotalTheta >= 0 ? '+' : ''} R$ {legTotalTheta.toFixed(1)}
                    </td>
                    <td className="py-1 text-right text-violet-300">{legTotalVega.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
