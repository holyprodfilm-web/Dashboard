import { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Home, Target, Loader2, LogOut, AlertCircle } from 'lucide-react';
import type { View, Meeting, Task, Address, Profile } from './types';
import { ROLE_LABELS, ROLE_COLORS } from './types';
import { supabase } from './lib/supabase';
import { filterMeetingsForRole, filterTasksForRole } from './lib/dataFilters';
import DashboardWrapper from './components/DashboardWrapper';
import ObjectsView from './components/ObjectsView';
import MeetingDetailView from './components/MeetingDetailView';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import ManagerTasksView from './components/ManagerTasksView';
import UsersView from './components/UsersView';
import BootstrapAdminBanner from './components/BootstrapAdminBanner';

function AppContent() {
  const { user, profile, loading, signOut, reloadProfile } = useAuth();
  const [view, setView] = useState<View>('home');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [selectedManager, setSelectedManager] = useState<string>('');

  const loadAllData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError('');

    const [addrRes, meetRes, taskRes, profileRes] = await Promise.all([
      supabase.from('addresses').select('*'),
      supabase.from('meetings').select('*').order('meeting_date', { ascending: false }),
      supabase.from('tasks').select('*'),
      supabase.from('profiles').select('*'),
    ]);

    const errors = [addrRes.error, meetRes.error, taskRes.error, profileRes.error].filter(Boolean);
    if (errors.length > 0) {
      setDataError(errors.map(e => e!.message).join('; '));
    }

    if (addrRes.data) setAddresses(addrRes.data);
    if (meetRes.data) setMeetings(meetRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    if (profileRes.data) setProfiles(profileRes.data);
    setDataLoading(false);
  }, [user]);

  const visibleMeetings = useMemo(
    () => filterMeetingsForRole(meetings, profile),
    [meetings, profile]
  );

  const visibleTasks = useMemo(
    () => filterTasksForRole(tasks, meetings, profile),
    [tasks, meetings, profile]
  );

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка данных при авторизации
      void loadAllData();
    }
  }, [user, loadAllData]);

  if (loading || (user && dataLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setView('home')}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Target className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  АРМ Управление мониторинга за строительством объектов теплоснабжения МО
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {view !== 'home' && (
                <button
                  onClick={() => setView('home')}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium text-sm"
                >
                  <Home size={18} /> На главную
                </button>
              )}

              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-slate-900">{profile?.full_name}</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${ROLE_COLORS[profile?.role || 'guest']}`}>
                    {ROLE_LABELS[profile?.role || 'guest']}
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Выйти"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <BootstrapAdminBanner
          currentProfile={profile}
          profiles={profiles}
          onPromoted={async () => {
            await reloadProfile();
            await loadAllData();
          }}
        />
        {dataError && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>Ошибка загрузки данных: {dataError}</span>
            <button
              onClick={loadAllData}
              className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-medium transition"
            >
              Повторить
            </button>
          </div>
        )}

        {view === 'home' && (
          <HomePage
            onNavigate={(newView) => setView(newView)}
            isAdmin={profile?.role === 'admin'}
          />
        )}
        {view === 'dashboard' && (
          <DashboardWrapper
            meetings={visibleMeetings}
            addresses={addresses}
            tasks={visibleTasks}
            profiles={profiles}
            onReload={loadAllData}
            onSelectMeeting={(id: number) => {
              setSelectedMeetingId(id);
              setView('detail');
            }}
            onMeetingCreated={(id: number) => {
              setSelectedMeetingId(id);
              setView('detail');
            }}
            onManagerClick={(managerName: string) => {
              setSelectedManager(managerName);
              setView('managerTasks');
            }}
          />
        )}
        {view === 'managerTasks' && (
          <ManagerTasksView
            managerName={selectedManager}
            meetings={visibleMeetings}
            tasks={visibleTasks}
            addresses={addresses}
            onBack={() => setView('dashboard')}
          />
        )}
        {view === 'objects' && (
          <ObjectsView
            addresses={addresses}
            tasks={visibleTasks}
            meetings={visibleMeetings}
            isAdmin={profile?.role === 'admin'}
            onReload={loadAllData}
          />
        )}
        {view === 'users' && profile?.role === 'admin' && (
          <UsersView profiles={profiles} onReload={loadAllData} />
        )}
        {view === 'detail' && selectedMeetingId && (
          <MeetingDetailView
            meetingId={selectedMeetingId}
            addresses={addresses}
            tasks={visibleTasks}
            profiles={profiles}
            meetings={visibleMeetings}
            onBack={() => setView('dashboard')}
            onReload={loadAllData}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
