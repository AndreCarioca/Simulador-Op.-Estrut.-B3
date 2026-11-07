import React from 'react';
import { OptionStyle } from '../types/options';

export const AmericanFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 640 480"
    className={`inline-block rounded-[2px] shadow-sm shrink-0 border border-slate-600/80 ${className}`}
    aria-label="Opção Americana (EUA)"
  >
    {/* Red background with white stripes */}
    <path fill="#b22234" d="M0 0h640v480H0z" />
    <path
      stroke="#ffffff"
      strokeWidth="37"
      d="M0 55.5h640M0 129.5h640M0 203.5h640M0 277.5h640M0 351.5h640M0 425.5h640"
    />
    {/* Blue canton */}
    <path fill="#3c3b6e" d="M0 0h260v260H0z" />
    {/* Stylized stars */}
    <g fill="#ffffff">
      <circle cx="50" cy="50" r="10" />
      <circle cx="130" cy="50" r="10" />
      <circle cx="210" cy="50" r="10" />
      <circle cx="90" cy="90" r="10" />
      <circle cx="170" cy="90" r="10" />
      <circle cx="50" cy="130" r="10" />
      <circle cx="130" cy="130" r="10" />
      <circle cx="210" cy="130" r="10" />
      <circle cx="90" cy="170" r="10" />
      <circle cx="170" cy="170" r="10" />
      <circle cx="50" cy="210" r="10" />
      <circle cx="130" cy="210" r="10" />
      <circle cx="210" cy="210" r="10" />
    </g>
  </svg>
);

export const EuropeanFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-3.5' }) => (
  <svg
    viewBox="0 0 640 480"
    className={`inline-block rounded-[2px] shadow-sm shrink-0 border border-slate-600/80 ${className}`}
    aria-label="Opção Européia (União Européia)"
  >
    {/* Blue background */}
    <path fill="#003399" d="M0 0h640v480H0z" />
    {/* Circle of 12 Yellow Stars */}
    <g fill="#ffcc00">
      <circle cx="320" cy="90" r="15" />
      <circle cx="320" cy="390" r="15" />
      <circle cx="170" cy="240" r="15" />
      <circle cx="470" cy="240" r="15" />
      <circle cx="215" cy="135" r="15" />
      <circle cx="425" cy="135" r="15" />
      <circle cx="215" cy="345" r="15" />
      <circle cx="425" cy="345" r="15" />
      <circle cx="145" cy="180" r="15" />
      <circle cx="495" cy="180" r="15" />
      <circle cx="145" cy="300" r="15" />
      <circle cx="495" cy="300" r="15" />
    </g>
  </svg>
);

interface StyleFlagBadgeProps {
  style: OptionStyle | 'N/A';
  showLabel?: boolean;
  className?: string;
}

export const StyleFlagBadge: React.FC<StyleFlagBadgeProps> = ({ style, showLabel = false, className = 'w-5 h-3.5' }) => {
  if (style === 'AMERICANA') {
    return (
      <span
        className="inline-flex items-center gap-1 cursor-help"
        title="Opção Americana (A): pode ser exercida a qualquer momento até a data de vencimento"
      >
        <AmericanFlag className={className} />
        <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-800/80 px-1 py-0.2 rounded leading-none">
          A
        </span>
        {showLabel && <span className="text-[10px] text-slate-300 font-mono">Americana</span>}
      </span>
    );
  }

  if (style === 'EUROPEIA') {
    return (
      <span
        className="inline-flex items-center gap-1 cursor-help"
        title="Opção Européia (E): pode ser exercida exclusivamente na data de vencimento"
      >
        <EuropeanFlag className={className} />
        <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/80 px-1 py-0.2 rounded leading-none">
          E
        </span>
        {showLabel && <span className="text-[10px] text-slate-300 font-mono">Européia</span>}
      </span>
    );
  }

  return null;
};
