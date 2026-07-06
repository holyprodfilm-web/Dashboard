import { useState } from 'react';
import { BarChart3, Archive, FolderOpen, Plus } from 'lucide-react';
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
  onStatusFilter?: (status: 'in_progress' | 'completed' | 'overdue') => void;
}

export default function DashboardWrapper({
  meetings,
  addresses,
  tasks,
  profiles,
  onReload,
  onSelectMeeting,
  onMeetingCreated,
  onManagerClick,
  onStatusFilter,
}: DashboardWrapperProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inwork' | 'archive'>('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const { canCreate } = usePermissions();

  // "Протоколы в работе": нет поручений ИЛИ есть незакрытые
  const inWorkMeetings = meetings.filter(m => {
    const mTasks = tasks.filter(t => t.meeting_id === m.id);
    if (mTasks.length === 0) return true;
    return mTasks.some(t => t.status !== 'completed');
  });

  // "Архив протоколов": все поручения закрыты (и хотя бы одно есть)
  const archivedMeetings = meetings.filter(m => {
    const mTasks = tasks.filter(t => t.meeting_id === m.id);
    if (mTasks.length === 0) return false;
    return mTasks.every(t => t.status === 'completed');
  });

  const tabs = [
    { id: 'dashboard' as const, label: 'Дашборд', icon: <BarChart3 size={17} /> },
    {
      id: 'inwork' as const,
      label: 'Протоколы в работе',
      icon: <FolderOpen size={17} />,
      count: inWorkMeetings.length,
    },
    {
      id: 'archive' as const,
      label: 'Архив протоколов',
      icon: <Archive size={17} />,
      count: archivedMeetings.length,
    },
  ];

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              {tab.label}
              {'count' in tab && tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? 'bg-teal-100 text-teal-600'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#E97386] to-[#EFA566] hover:from-[#d4607a] hover:to-[#e0925a] text-white rounded-xl shadow-lg shadow-[#E97386]/20 transition-all text-sm font-medium"
          >
            <Plus size={18} /> Новый протокол
          </button>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <DashboardView
          tasks={tasks}
          meetings={meetings}
          addresses={addresses}
          onManagerClick={onManagerClick}
          onStatusFilter={onStatusFilter}
        />
      )}

      {activeTab === 'inwork' && (
        <MeetingsListView
          meetings={inWorkMeetings}
          tasks={tasks}
          onReload={onReload}
          onSelectMeeting={onSelectMeeting}
          title="Протоколы в работе"
          emptyMessage="Нет протоколов в работе"
        />
      )}

      {activeTab === 'archive' && (
        <MeetingsListView
          meetings={archivedMeetings}
          tasks={tasks}
          onReload={onReload}
          onSelectMeeting={onSelectMeeting}
          title="Архив протоколов"
          emptyMessage="Архив пуст — закройте все поручения протокола, чтобы он попал сюда"
        />
      )}

      {showCreate && (
        <CreateMeetingModal
          addresses={addresses}
          profiles={profiles}
          onClose={() => setShowCreate(false)}
          onCreated={(meetingId: number) => {
            setShowCreate(false);
            setActiveTab('inwork');
            onReload();
            onMeetingCreated(meetingId);
          }}
        />
      )}
    </>
  );
}
