import { useState } from 'react';
import { BarChart3, Archive, Plus } from 'lucide-react';
import type { Address, Meeting, Task, Profile } from '../types';
import { usePermissions } from '../lib/usePermissions';
import DashboardView from './DashboardView';
import MeetingsListView from './MeetingsListView';
import CreateMeetingModal from './CreateMeetingModal';

interface DashboardWrapperProps {
  meetings: Meeting[];
  addresses: Address[];
  tasks: Task[];
  profiles: Profile[];
  onReload: () => void;
  onSelectMeeting: (id: number) => void;
  onMeetingCreated: (id: number) => void;
  onManagerClick: (managerName: string) => void;
}

export default function DashboardWrapper({ 
  meetings, 
  addresses, 
  tasks, 
  profiles, 
  onReload, 
  onSelectMeeting, 
  onMeetingCreated,
  onManagerClick 
}: DashboardWrapperProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'archive'>('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const { canCreate } = usePermissions();

  const tabs = [
    { id: 'dashboard' as const, label: 'Дашборд', icon: <BarChart3 size={18} /> },
    { id: 'archive' as const, label: 'Архив совещаний', icon: <Archive size={18} /> },
  ];

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'dashboard' && canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all"
          >
            <Plus size={18} /> Новое совещание
          </button>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <DashboardView
          tasks={tasks}
          meetings={meetings}
          onManagerClick={onManagerClick}
        />
      )}

      {activeTab === 'archive' && (
        <MeetingsListView
          meetings={meetings}
          tasks={tasks}
          onReload={onReload}
          onSelectMeeting={onSelectMeeting}
        />
      )}

      {showCreate && (
        <CreateMeetingModal
          addresses={addresses}
          profiles={profiles}
          onClose={() => setShowCreate(false)}
          onCreated={(meetingId: number) => {
            setShowCreate(false);
            onReload();
            onMeetingCreated(meetingId);
          }}
        />
      )}
    </>
  );
}