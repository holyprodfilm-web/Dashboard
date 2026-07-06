import { useState, useEffect } from 'react';
import { DatabaseBackup, RefreshCw, ChevronRight, ChevronDown, Loader2, AlertCircle, HardDrive, Table2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DatabaseBackupRow {
  id: number;
  filename: string;
  size_bytes: number;
  tables_summary: Record<string, number>;
  created_at: string;
}

const BASE_TABLES: Array<{ key: string; label: string }> = [
  { key: 'addresses',           label: 'Адреса'               },
  { key: 'closure_objects',     label: 'Объекты закрытия'     },
  { key: 'closure_changes',     label: 'Изменения закрытия'   },
  { key: 'tasks',               label: 'Поручения'            },
  { key: 'task_links',          label: 'Связи поручений'      },
  { key: 'meetings',            label: 'Совещания'            },
  { key: 'meeting_attachments', label: 'Вложения совещаний'   },
  { key: 'profiles',            label: 'Профили пользователей'},
  { key: 'role_permissions',    label: 'Права доступа'        },
];

const NTS_TABLES: Array<{ key: string; label: string }> = [
  { key: 'nts_entries',             label: 'НТС: Объекты'          },
  { key: 'nts_sessions',            label: 'НТС: Заседания'        },
  { key: 'nts_doc_rounds',          label: 'НТС: Туры документации'},
  { key: 'nts_checklist_responses', label: 'НТС: Ответы чек-листа' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function BackupViewer() {
  const [backups, setBackups] = useState<DatabaseBackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadBackups = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('database_backups')
      .select('id, filename, size_bytes, tables_summary, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (err) setError(err.message);
    else setBackups((data ?? []) as DatabaseBackupRow[]);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  };

  useEffect(() => { void loadBackups(); }, []);

  const toggle = (id: number) => setExpandedId(prev => prev === id ? null : id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-teal-600" size={36} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 flex items-center gap-3">
            <DatabaseBackup size={28} className="text-teal-600" />
            Резервные копии базы данных
          </h2>
          <p className="text-slate-500">История автоматических ночных резервных копий (последние 30)</p>
        </div>
        <button
          onClick={() => loadBackups(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-sm font-medium transition disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          Ошибка загрузки: {error}
        </div>
      )}

      {backups.length === 0 && !error && (
        <div className="py-20 text-center text-slate-400">
          <DatabaseBackup size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Резервные копии ещё не созданы</p>
        </div>
      )}

      <div className="space-y-2">
        {backups.map(backup => {
          const isOpen = expandedId === backup.id;
          const summary = backup.tables_summary ?? {};
          const totalRows = Object.values(summary).reduce((a, b) => a + b, 0);
          const ntsRows = NTS_TABLES.reduce((sum, t) => sum + (summary[t.key] ?? 0), 0);

          return (
            <div
              key={backup.id}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Header row */}
              <button
                onClick={() => toggle(backup.id)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition text-left"
              >
                <span className="text-slate-400">
                  {isOpen
                    ? <ChevronDown size={18} />
                    : <ChevronRight size={18} />}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-medium text-slate-800 truncate">
                      {backup.filename}
                    </span>
                    {ntsRows > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium shrink-0">
                        НТС: {ntsRows} зап.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-400">
                    <span>{formatDatetime(backup.created_at)}</span>
                    <span className="flex items-center gap-1">
                      <HardDrive size={11} />
                      {formatBytes(backup.size_bytes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Table2 size={11} />
                      {totalRows.toLocaleString('ru-RU')} строк всего
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-slate-100 px-6 py-5 bg-slate-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Base tables */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Основные таблицы
                      </h4>
                      <div className="space-y-1">
                        {BASE_TABLES.map(t => (
                          <div key={t.key} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                            <span className="text-slate-600">{t.label}</span>
                            <span className={`font-medium tabular-nums ${
                              (summary[t.key] ?? 0) > 0 ? 'text-slate-800' : 'text-slate-300'
                            }`}>
                              {(summary[t.key] ?? 0).toLocaleString('ru-RU')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* NTS tables */}
                    <div>
                      <h4 className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        НТС
                        <span className="normal-case font-normal text-indigo-400 lowercase tracking-normal">(научно-технический совет)</span>
                      </h4>
                      <div className="space-y-1">
                        {NTS_TABLES.map(t => (
                          <div key={t.key} className="flex items-center justify-between text-sm py-1 border-b border-indigo-50 last:border-0">
                            <span className="text-slate-600">{t.label}</span>
                            <span className={`font-medium tabular-nums ${
                              (summary[t.key] ?? 0) > 0 ? 'text-indigo-700' : 'text-slate-300'
                            }`}>
                              {(summary[t.key] ?? 0).toLocaleString('ru-RU')}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm font-semibold bg-indigo-50 rounded-xl px-4 py-2.5">
                        <span className="text-indigo-700">Итого НТС</span>
                        <span className="text-indigo-800 tabular-nums">{ntsRows.toLocaleString('ru-RU')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Grand total */}
                  <div className="mt-4 flex items-center justify-between text-sm font-semibold bg-slate-100 rounded-xl px-4 py-2.5">
                    <span className="text-slate-600">Всего строк в копии</span>
                    <span className="text-slate-800 tabular-nums">{totalRows.toLocaleString('ru-RU')}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
