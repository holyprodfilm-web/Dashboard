import type { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'blue' | 'amber' | 'emerald' | 'red';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
};

export default function KpiCard({ title, value, icon, color }: KpiCardProps) {
  const colors = colorClasses[color];
  
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center mb-3`}>
        <div className={colors.text}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
    </div>
  );
}