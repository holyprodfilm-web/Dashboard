import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Home, Target, Loader2, LogOut, AlertCircle, UserCircle } from 'lucide-react';
import NotificationBell from './components/NotificationBell';
import UserProfileModal from './components/UserProfileModal';
import type { View, Meeting, Task, Address, Profile, RolePermission } from './types';
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
import NtsView from './components/NtsView';
import BackupViewer from './components/BackupViewer';
import Toast from './components/Toast';
import AchievementToastQueue from './components/AchievementToast';
import { useAchievements } from './hooks/useAchievements';

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
  const [showAchievements, setShowAchievements] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [showReconnectToast, setShowReconnectToast] = useState(false);
  const [reconnectRefreshing, setReconnectRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [roleChangeToast, setRoleChangeToast] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const hadErrorRef = useRef(false);
  const disconnectedAtRef = useRef<number | null>(null);
  const currentRoleRef = useRef<string | null>(null);
  const currentDistrictsRef = useRef<string[] | null | undefined>(undefined);

  const { pendingToasts, dismissToast } = useAchievements(user?.id);

  // Keep currentRoleRef and currentDistrictsRef in sync so the realtime handler can compare old vs new values
  useEffect(() => {
    currentRoleRef.current = profile?.role ?? null;
  }, [profile?.role]);

  useEffect(() => {
    currentDistrictsRef.current = profile?.districts;
  }, [profile?.districts]);

  // Redirect away from admin-only views if the current user's role changes
  useEffect(() => {
    if (view === 'users' && profile?.role !== 'admin') {
      setView('home');
    }
  }, [profile?.role, view]);

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

  // Quick refresh: all mutable datasets except addresses (extremely rare to change)
  // Used after brief disconnects (<90 s) to skip the heavier full loadAllData
  const quickRefresh = useCallback(async () => {
    if (!user) return;
    const [meetRes, taskRes, profileRes, permRes] = await Promise.all([
      supabase.from('meetings').select('*').order('meeting_date', { ascending: false }),
      supabase.from('tasks').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('role_permissions').select('*'),
    ]);
    if (meetRes.data) setMeetings(meetRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    if (profileRes.data) setProfiles(profileRes.data);
    if (permRes.data) setRolePermissions(permRes.data);
  }, [user]);

  const loadAllData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError('');

    const [addrRes, meetRes, taskRes, profileRes, permRes] = await Promise.all([
      supabase.from('addresses').select('*'),
      supabase.from('meetings').select('*').order('meeting_date', { ascending: false }),
      supabase.from('tasks').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('role_permissions').select('*'),
    ]);

    const errors = [addrRes.error, meetRes.error, taskRes.error, profileRes.error, permRes.error].filter(Boolean);
    if (errors.length > 0) {
      setDataError(errors.map(e => e!.message).join('; '));
    }

    if (addrRes.data) setAddresses(addrRes.data);
    if (meetRes.data) setMeetings(meetRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    if (profileRes.data) setProfiles(profileRes.data);
    if (permRes.data) setRolePermissions(permRes.data as RolePermission[]);
    setDataLoading(false);
  }, [user]);

  // Module access guard: admin always has access; responsible_modules designation grants access too
  const hasModule = useCallback((module: string): boolean => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    if (profile.responsible_modules?.includes(module)) return true;
    const perm = rolePermissions.find(p => p.role === profile.role && p.module === module);
    if (rolePermissions.length === 0) return true;
    return perm?.can_access ?? false;
  }, [profile, rolePermissions]);

  // Admin-level access within a specific module (admin role OR responsible_modules designation)
  const isModuleAdmin = useCallback((module: string): boolean => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return profile.responsible_modules?.includes(module) ?? false;
  }, [profile]);

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
              const incoming = payload.new as Task;
              // Deduplicate: onReload() may have already added this task
              if (prev.some((t) => t.id === incoming.id)) return prev;
              return [...prev, incoming];
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
            const newRole = (payload.new as Profile).role;
            const oldRole = currentRoleRef.current;
            if (newRole && oldRole && newRole !== oldRole) {
              setRoleChangeToast(`Ваша роль изменена на «${ROLE_LABELS[newRole] ?? newRole}»`);
            }
            const newDistricts: string[] | null = (payload.new as Profile).districts ?? null;
            const oldDistricts = currentDistrictsRef.current ?? null;
            const districtsChanged =
              JSON.stringify([...(oldDistricts ?? [])].sort()) !==
              JSON.stringify([...(newDistricts ?? [])].sort());
            if (districtsChanged && currentDistrictsRef.current !== undefined) {
              setRoleChangeToast('Ваши районы изменены администратором');
            }
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
            const disconnectedMs = disconnectedAtRef.current
              ? Date.now() - disconnectedAtRef.current
              : Infinity;
            setShowReconnectToast(true);
            setReconnectRefreshing(true);
            // Brief disconnect (switching apps, tab sleep <90s) → fast 2-table refresh
            // Long disconnect → full reload to catch all missed changes
            const refreshFn = disconnectedMs < 90_000 ? quickRefresh : loadAllData;
            void refreshFn().finally(() => setReconnectRefreshing(false));
            hadErrorRef.current = false;
            disconnectedAtRef.current = null;
          }
          setRealtimeStatus('live');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!hadErrorRef.current) disconnectedAtRef.current = Date.now();
          hadErrorRef.current = true;
          setRealtimeStatus('error');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    // Page Visibility API — when the user returns to the tab, reconnect if the channel dropped
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const state = channel.state;
      if (state !== 'joined' && state !== 'joining') {
        void channel.subscribe();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void supabase.removeChannel(channel);
      setRealtimeStatus('connecting');
    };
  }, [user, loadAllData, quickRefresh]);

  if (loading || (user && dataLoading && !reconnectRefreshing)) {
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
                    {reconnectRefreshing ? (
                      <Loader2 className="animate-spin text-teal-500 shrink-0" size={14} />
                    ) : (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                    )}
                    <span className="text-xs font-medium text-emerald-600 hidden sm:inline">
                      {reconnectRefreshing ? 'Обновление…' : 'Live'}
                    </span>
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

              <NotificationBell
                tasks={visibleTasks}
                addresses={addresses}
                districts={profile?.districts}
                isSuperUser={profile?.role === 'admin' || (profile?.responsible_modules?.length ?? 0) > 0}
                moduleAccess={
                  profile?.role === 'admin'
                    ? { dashboard: true, objects: true, closure: true, nts: true }
                    : Object.fromEntries(
                        ['dashboard', 'objects', 'closure', 'nts'].map(mod => [mod, hasModule(mod)])
                      )
                }
                onNavigate={(v) => setView(v as View)}
              />

              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-slate-900">{profile?.full_name}</div>
                  <div className="flex items-center gap-1 justify-end flex-wrap mt-0.5">
                    <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${ROLE_COLORS[profile?.role || 'guest']}`}>
                      {ROLE_LABELS[profile?.role || 'guest']}
                    </div>
                    {(profile?.responsible_modules?.length ?? 0) > 0 && (
                      <div className="text-xs px-2 py-0.5 rounded-full inline-block bg-orange-100 text-orange-700">
                        Отв. за модуль
                      </div>
                    )}
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
              onClick={async () => {
                setRetrying(true);
                await loadAllData();
                setRetrying(false);
              }}
              disabled={retrying}
              className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-[#FFD6DC] hover:bg-[#FFB3BF] disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition"
            >
              {retrying && <Loader2 size={12} className="animate-spin" />}
              {retrying ? 'Загрузка…' : 'Повторить'}
            </button>
          </div>
        )}

        {view === 'home' && (
          <HomePage
            onNavigate={(newView) => setView(newView as View)}
            isAdmin={profile?.role === 'admin'}
            moduleAccess={
              profile?.role === 'admin'
                ? undefined
                : Object.fromEntries(
                    ['dashboard', 'objects', 'closure', 'nts'].map(mod => [mod, hasModule(mod)])
                  ) as Record<string, boolean>
            }
          />
        )}
        {view === 'closure' && hasModule('closure') && <ClosureView />}
        {view === 'dashboard' && hasModule('dashboard') && (
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
        {view === 'objects' && hasModule('objects') && (
          <ObjectsView
            addresses={addresses}
            tasks={visibleTasks}
            meetings={visibleMeetings}
            isAdmin={isModuleAdmin('objects')}
            onReload={loadAllData}
            statusFilter={objectsStatusFilter}
            onClearFilter={() => setObjectsStatusFilter(null)}
            currentUserId={profile?.id}
          />
        )}
        {view === 'nts' && hasModule('nts') && (
          <NtsView
            profiles={profiles}
            currentUserId={profile?.id}
            currentUserRole={profile?.role}
            isModuleAdmin={isModuleAdmin('nts')}
          />
        )}
        {view === 'users' && profile?.role === 'admin' && (
          <UsersView
            profiles={profiles}
            rolePermissions={rolePermissions}
            onReload={loadAllData}
            onPermissionUpdated={(perm) =>
              setRolePermissions(prev => {
                const idx = prev.findIndex(p => p.role === perm.role && p.module === perm.module);
                if (idx >= 0) { const next = [...prev]; next[idx] = perm; return next; }
                return [...prev, perm];
              })
            }
          />
        )}
        {view === 'backups' && profile?.role === 'admin' && (
          <BackupViewer />
        )}
        {showProfile && (
          <UserProfileModal
            onClose={() => { setShowProfile(false); setShowAchievements(false); }}
            openAchievements={showAchievements}
          />
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
            onTaskCreated={(task) =>
              setTasks((prev) =>
                prev.some((t) => t.id === task.id) ? prev : [...prev, task]
              )
            }
          />
        )}
      </main>
      {showReconnectToast && (
        <Toast
          message="Данные обновлены"
          duration={3000}
          onClose={() => setShowReconnectToast(false)}
        />
      )}
      {roleChangeToast && (
        <Toast
          message={roleChangeToast}
          duration={5000}
          onClose={() => setRoleChangeToast(null)}
        />
      )}
      <AchievementToastQueue
        toasts={pendingToasts}
        onDismiss={dismissToast}
        onOpenAchievements={() => { setShowAchievements(true); setShowProfile(true); }}
      />
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
