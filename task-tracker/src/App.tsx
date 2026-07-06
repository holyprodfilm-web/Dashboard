import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Home, Target, Loader2, LogOut, AlertCircle, UserCircle } from 'lucide-react';
import UserProfileModal from './components/UserProfileModal';
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
import ClosureView from './components/ClosureView';
import Toast from './components/Toast';

function AppContent() {
  const { user, profile, loading, signOut, reloadProfile } = useAuth();
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    const kpi = params.get('kpi');
    if (kpi && ['in_work', 'completed', 'overdue'].includes(kpi)) return 'objects';
    return 'home';
  });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [objectsStatusFilter, setObjectsStatusFilter] = useState<'in_work' | 'completed' | 'overdue' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const kpi = params.get('kpi');
    if (kpi && ['in_work', 'completed', 'overdue'].includes(kpi)) {
      return kpi as 'in_work' | 'completed' | 'overdue';
    }
    return null;
  });
  const [showProfile, setShowProfile] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [showReconnectToast, setShowReconnectToast] = useState(false);
  const hadErrorRef = useRef(false);

  // Sync ?kpi= URL param with the external status filter (for shareability)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (view === 'objects' && objectsStatusFilter) {
      params.set('kpi', objectsStatusFilter);
    } else {
      params.delete('kpi');
    }
    const newSearch = params.toString();
    const newUrl = newSearch
      ? `${window.location.pathname}?${newSearch}`
      : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [view, objectsStatusFilter]);

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

  // Real-time subscription: keep tasks, meetings and addresses in sync
  useEffect(() => {
    if (!user) return;

    setRealtimeStatus('connecting');

    const channel = supabase
      .channel('app-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new as Task];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((t) =>
                t.id === (payload.new as Task).id ? (payload.new as Task) : t
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((t) => t.id !== (payload.old as Task).id);
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        (payload) => {
          setMeetings((prev) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as Meeting, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((m) =>
                m.id === (payload.new as Meeting).id ? (payload.new as Meeting) : m
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((m) => m.id !== (payload.old as Meeting).id);
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'addresses' },
        (payload) => {
          setAddresses((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new as Address];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((a) =>
                a.id === (payload.new as Address).id ? (payload.new as Address) : a
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((a) => a.id !== (payload.old as Address).id);
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && user && (payload.new as Profile).id === user.id) {
            void reloadProfile();
          }
          setProfiles((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new as Profile];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((p) =>
                p.id === (payload.new as Profile).id ? (payload.new as Profile) : p
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((p) => p.id !== (payload.old as Profile).id);
            }
            return prev;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (hadErrorRef.current) {
            setShowReconnectToast(true);
            void loadAllData();
            hadErrorRef.current = false;
          }
          setRealtimeStatus('live');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          hadErrorRef.current = true;
          setRealtimeStatus('error');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      setRealtimeStatus('connecting');
    };
  }, [user, loadAllData]);

  if (loading || (user && dataLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-teal-600" size={40} />
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
              <div className="w-10 h-10 bg-gradient-to-br from-[#E97386] to-[#EFA566] rounded-xl flex items-center justify-center shadow-lg shadow-[#E97386]/20">
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
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition font-medium text-sm"
                >
                  <Home size={18} /> На главную
                </button>
              )}

              {/* Real-time sync indicator */}
              <div
                className="flex items-center gap-1.5"
                title={
                  realtimeStatus === 'live'
                    ? 'Данные синхронизируются в реальном времени'
                    : realtimeStatus === 'error'
                    ? 'Соединение с сервером потеряно'
                    : 'Подключение к серверу…'
                }
              >
                {realtimeStatus === 'live' && (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-medium text-emerald-600 hidden sm:inline">Live</span>
                  </>
                )}
                {realtimeStatus === 'error' && (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                    </span>
                    <span className="text-xs font-medium text-amber-600 hidden sm:inline">Офлайн</span>
                  </>
                )}
                {realtimeStatus === 'connecting' && (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-300 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400" />
                    </span>
                    <span className="text-xs font-medium text-slate-400 hidden sm:inline">Синхр…</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-slate-900">{profile?.full_name}</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${ROLE_COLORS[profile?.role || 'guest']}`}>
                    {ROLE_LABELS[profile?.role || 'guest']}
                  </div>
                </div>
                <button
                  onClick={() => setShowProfile(true)}
                  className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                  title="Личный кабинет"
                >
                  <UserCircle size={20} />
                </button>
                <button
                  onClick={signOut}
                  className="p-2 text-slate-400 hover:text-[#E93A58] hover:bg-[#FFF0F3] rounded-lg transition"
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
          <div className="mb-6 flex items-center gap-3 p-4 bg-[#FFF0F3] border border-[#FFB3BF] rounded-xl text-[#c42d49] text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>Ошибка загрузки данных: {dataError}</span>
            <button
              onClick={loadAllData}
              className="ml-auto px-3 py-1 bg-[#FFD6DC] hover:bg-[#FFB3BF] rounded-lg text-xs font-medium transition"
            >
              Повторить
            </button>
          </div>
        )}

        {view === 'home' && (
          <HomePage
            onNavigate={(newView) => setView(newView as View)}
            isAdmin={profile?.role === 'admin'}
          />
        )}
        {view === 'closure' && <ClosureView />}
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
            onStatusFilter={(status) => {
              // 'in_progress' from dashboard means both in_progress + new tasks
              setObjectsStatusFilter(status === 'in_progress' ? 'in_work' : status);
              setView('objects');
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
            statusFilter={objectsStatusFilter}
            onClearFilter={() => setObjectsStatusFilter(null)}

          />
        )}
        {view === 'users' && profile?.role === 'admin' && (
          <UsersView profiles={profiles} onReload={loadAllData} />
        )}
        {showProfile && (
          <UserProfileModal onClose={() => setShowProfile(false)} />
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
      {showReconnectToast && (
        <Toast
          message="Данные обновлены"
          onClose={() => setShowReconnectToast(false)}
          persistent
        />
      )}
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
