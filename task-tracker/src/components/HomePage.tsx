import type { ReactNode } from 'react';
import { FileText, Building2, ArrowRight, Users } from 'lucide-react';

type ModuleId = 'dashboard' | 'objects' | 'users';

interface Module {
  id: ModuleId;
  title: string;
  description: string;
  icon: ReactNode;
  bg: string;
  text: string;
  hoverBorder: string;
}

interface HomePageProps {
  onNavigate: (view: ModuleId) => void;
  isAdmin?: boolean;
}

const dashboardModule: Module = {
  id: 'dashboard',
  title: 'Протокольные поручения',
  description: 'Аналитика, протоколы совещаний и контроль исполнения поручений.',
  icon: <FileText size={32} />,
  bg: 'bg-blue-50',
  text: 'text-blue-600',
  hoverBorder: 'group-hover:border-blue-200',
};

const objectsModule: Module = {
  id: 'objects',
  title: 'Объекты ГП',
  description: 'Единый справочник объектов, руководителей проектов и городских округов.',
  icon: <Building2 size={32} />,
  bg: 'bg-emerald-50',
  text: 'text-emerald-600',
  hoverBorder: 'group-hover:border-emerald-200',
};

const usersModule: Module = {
  id: 'users',
  title: 'Пользователи',
  description: 'Управление ролями и правами доступа пользователей системы.',
  icon: <Users size={32} />,
  bg: 'bg-purple-50',
  text: 'text-purple-600',
  hoverBorder: 'group-hover:border-purple-200',
};

export default function HomePage({ onNavigate, isAdmin }: HomePageProps) {
  const modules: Module[] = isAdmin
    ? [dashboardModule, objectsModule, usersModule]
    : [dashboardModule, objectsModule];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Добро пожаловать в систему!
        </h2>
        <p className="text-slate-500">Выберите раздел для начала работы</p>
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => onNavigate(module.id)}
            className={`group bg-white p-8 rounded-2xl border border-slate-200 hover:shadow-xl ${module.hoverBorder} transition-all duration-300 text-left`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${module.bg} ${module.text} group-hover:scale-110 transition-transform duration-300`}>
              {module.icon}
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-3">
              {module.title}
            </h3>
            
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              {module.description}
            </p>
            
            <div className={`flex items-center ${module.text} font-medium text-sm`}>
              Открыть раздел 
              <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
