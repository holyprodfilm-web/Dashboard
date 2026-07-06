import { useState, useEffect, useRef } from 'react';
import { Paperclip, Upload, Download, Trash2, Loader2, FileText, File } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../lib/usePermissions';
import type { MeetingAttachment } from '../types';

const BUCKET = 'meeting-files';
const MAX_SIZE_MB = 20;
const ACCEPTED = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText size={18} className="text-[#E93A58] shrink-0" />;
  return <File size={18} className="text-teal-500 shrink-0" />;
}

interface Props {
  meetingId: number;
}

export default function MeetingAttachments({ meetingId }: Props) {
  const { user } = useAuth();
  const { canCreate, canDelete } = usePermissions();
  const [attachments, setAttachments] = useState<MeetingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from('meeting_attachments')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false });
    if (data) setAttachments(data);
  };

  useEffect(() => { void load(); }, [meetingId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!inputRef.current) return;
    inputRef.current.value = '';
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Файл слишком большой. Максимум ${MAX_SIZE_MB} МБ.`);
      return;
    }
    setError('');
    setUploading(true);

    // Supabase Storage requires ASCII-only keys — strip all non-ASCII characters.
    // The original filename is preserved separately in the `file_name` DB column.
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const baseName = file.name
      .replace(/\.[^.]+$/, '')           // strip extension
      .replace(/[^a-zA-Z0-9._-]/g, '_') // replace non-ASCII (incl. Cyrillic) with _
      .replace(/_+/g, '_')              // collapse consecutive underscores
      .replace(/^_+|_+$/g, '')          // trim leading/trailing underscores
      || 'file';
    const safeName = baseName + ext;
    const path = `${meetingId}/${Date.now()}_${safeName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file);

    if (uploadError) {
      setError('Ошибка загрузки: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('meeting_attachments').insert([{
      meeting_id: meetingId,
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      uploaded_by: user?.id,
    }]);

    if (dbError) {
      setError('Ошибка сохранения: ' + dbError.message);
    } else {
      await load();
    }
    setUploading(false);
  };

  const handleOpen = async (att: MeetingAttachment) => {
    setOpening(att.id);
    const { data, error: urlErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(att.file_path, 3600);
    setOpening(null);
    if (urlErr || !data?.signedUrl) {
      setError('Не удалось получить ссылку на файл.');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleDelete = async (att: MeetingAttachment) => {
    if (!window.confirm(`Удалить файл «${att.file_name}»?`)) return;
    await supabase.storage.from(BUCKET).remove([att.file_path]);
    await supabase.from('meeting_attachments').delete().eq('id', att.id);
    await load();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Paperclip size={18} className="text-slate-400" />
          <h3 className="font-semibold text-slate-800">Вложения</h3>
          {attachments.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{attachments.length}</span>
          )}
        </div>
        {canCreate && (
          <label className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl cursor-pointer transition
            ${uploading
              ? 'bg-slate-100 text-slate-400 pointer-events-none'
              : 'bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-200'}`}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? 'Загрузка...' : 'Загрузить файл'}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-[#E93A58] bg-[#FFF0F3] rounded-lg px-3 py-2">{error}</div>
      )}

      {attachments.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">
          <Paperclip size={24} className="mx-auto mb-2 opacity-30" />
          <p>Файлов пока нет</p>
          {canCreate && <p className="text-xs mt-1">Поддерживаются PDF и Word до {MAX_SIZE_MB} МБ</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group">
              <FileIcon name={att.file_name} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{att.file_name}</div>
                {att.file_size && (
                  <div className="text-xs text-slate-400">{formatSize(att.file_size)}</div>
                )}
              </div>
              <button
                onClick={() => handleOpen(att)}
                disabled={opening === att.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition"
                title="Открыть / скачать"
              >
                {opening === att.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Открыть
              </button>
              {canDelete && (
                <button
                  onClick={() => handleDelete(att)}
                  className="p-1.5 text-slate-300 hover:text-[#E93A58] hover:bg-[#FFF0F3] rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
