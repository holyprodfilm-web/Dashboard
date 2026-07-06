import type { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'blue' | 'amber' | 'emerald' | 'red';
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    hover: '',
    ring: '',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    hover: 'hover:border-amber-300 hover:shadow-md hover:bg-amber-50/60 cursor-pointer',
    ring: 'active:ring-2 active:ring-amber-300',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    hover: 'hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/60 cursor-pointer',
    ring: 'active:ring-2 active:ring-emerald-300',
  },
  red: {
    bg: 'bg-[#FFF0F3]',
    text: 'text-[#E93A58]',
    hover: 'hover:border-[#FF8099] hover:shadow-md hover:bg-[#FFF0F3]/60 cursor-pointer',
    ring: 'active:ring-2 active:ring-[#FF8099]',
  },
};

export default function KpiCard({ title, value, icon, color, onClick }: KpiCardProps) {
  const colors = colorClasses[color];
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all select-none
        ${isClickable ? `${colors.hover} ${colors.ring}` : ''}`}
      title={isClickable ? `Перейти к объектам: «${title}»` : undefined}
    >
      <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center mb-3`}>
        <div className={colors.text}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-500 flex items-center justify-between">
        <span>{title}</span>
        {isClickable && <span className="text-xs opacity-50">↗ объекты</span>}
      </div>
    </div>
  );
}
