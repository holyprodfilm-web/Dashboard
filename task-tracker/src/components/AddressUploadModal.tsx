import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileText, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../lib/usePermissions';
import type { Address } from '../types';

interface AddressUploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

// Expected CSV columns (flexible matching)
const COL_UIN = ['код уин', 'уин', 'uin', 'код'];
const COL_NAME = ['наименование объекта', 'наименование', 'объект', 'название'];
const COL_DISTRICT = ['городской округ', 'округ', 'район', 'district'];
const COL_MANAGER = ['руководитель проекта', 'руководитель', 'менеджер', 'manager'];
const COL_TYPE = ['тип объекта', 'тип', 'type'];
const COL_YEAR = ['год реализации', 'год', 'year'];

function findCol(headers: string[], variants: string[]): number {
  return headers.findIndex(h => variants.some(v => h.toLowerCase().trim() === v));
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

export default function AddressUploadModal({ onClose, onUploaded }: AddressUploadModalProps) {
  const { isAdmin } = usePermissions();
  const [preview, setPreview] = useState<Address[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [replaceAll, setReplaceAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setParseError('');
    setPreview(null);
    setUploadResult(null);
    setUploadError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) { setParseError('Файл пустой или содержит только заголовок.'); return; }

        const headers = rows[0];
        const iUin = findCol(headers, COL_UIN);
        const iName = findCol(headers, COL_NAME);
        const iDistrict = findCol(headers, COL_DISTRICT);
        const iManager = findCol(headers, COL_MANAGER);
        const iType = findCol(headers, COL_TYPE);
        const iYear = findCol(headers, COL_YEAR);

        if (iUin === -1) { setParseError(`Не найдена колонка "Код УИН". Заголовки: ${headers.join(', ')}`); return; }
        if (iName === -1) { setParseError(`Не найдена колонка "Наименование объекта". Заголовки: ${headers.join(', ')}`); return; }
        if (iDistrict === -1) { setParseError(`Не найдена колонка "Городской округ". Заголовки: ${headers.join(', ')}`); return; }

        const parsed: Address[] = rows.slice(1)
          .filter(r => r[iUin]?.trim() && r[iName]?.trim())
          .map(r => ({
            "Код УИН": r[iUin].trim(),
            "Наименование объекта": r[iName].trim(),
            "Городской округ": iDistrict >= 0 ? (r[iDistrict]?.trim() || '') : '',
            ...(iManager >= 0 && r[iManager]?.trim() ? { "Руководитель проекта": r[iManager].trim() } : {}),
            ...(iType >= 0 && r[iType]?.trim() ? { "Тип объекта": r[iType].trim() } : {}),
            ...(iYear >= 0 && r[iYear]?.trim() ? { "Год реализации": r[iYear].trim() } : {}),
          }));

        if (parsed.length === 0) { setParseError('Нет строк с данными (колонки УИН и Наименование обязательны).'); return; }
        setPreview(parsed);
      } catch (err) {
        setParseError('Ошибка разбора файла: ' + String(err));
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!preview) return;
    if (!isAdmin) {
      setUploadError('Только администраторы могут загружать объекты.');
      return;
    }
    setUploading(true);
    setUploadError('');

    try {
      if (replaceAll) {
        const { error: delErr } = await supabase.from('addresses').delete().neq('Код УИН', '__nonexistent__');
        if (delErr) throw new Error('Ошибка удаления: ' + delErr.message);
      }

      // Upsert in batches of 200
      const BATCH = 200;
      let inserted = 0;
      for (let i = 0; i < preview.length; i += BATCH) {
        const batch = preview.slice(i, i + BATCH);
        const { error } = await supabase.from('addresses').upsert(batch, { onConflict: 'Код УИН' });
        if (error) throw new Error(`Ошибка загрузки (строки ${i + 1}–${i + batch.length}): ${error.message}`);
        inserted += batch.length;
      }

      setUploadResult({ inserted, skipped: 0 });
      onUploaded();
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Upload size={20} className="text-blue-600" />
            Загрузка справочника объектов
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Format hint */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Формат CSV-файла</p>
            <p>Обязательные колонки: <code className="bg-blue-100 px-1 rounded">Код УИН</code>, <code className="bg-blue-100 px-1 rounded">Наименование объекта</code>, <code className="bg-blue-100 px-1 rounded">Городской округ</code></p>
            <p className="mt-1">Необязательные: <code className="bg-blue-100 px-1 rounded">Руководитель проекта</code>, <code className="bg-blue-100 px-1 rounded">Тип объекта</code>, <code className="bg-blue-100 px-1 rounded">Год реализации</code></p>
            <p className="mt-1 text-blue-700">Разделитель: запятая или точка с запятой. Кодировка: UTF-8.</p>
          </div>

          {/* Drop zone */}
          {!preview && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
            >
              <FileText className="mx-auto mb-3 text-slate-400" size={36} />
              <p className="font-medium text-slate-700">Перетащите CSV-файл сюда или нажмите для выбора</p>
              <p className="text-sm text-slate-400 mt-1">Поддерживается только формат .csv</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Preview */}
          {preview && !uploadResult && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText size={15} className="text-blue-500" />
                  <span className="font-medium">{fileName}</span>
                  <span className="text-slate-400">— {preview.length} объектов</span>
                </div>
                <button
                  onClick={() => { setPreview(null); setFileName(''); }}
                  className="text-xs text-slate-400 hover:text-red-500 transition flex items-center gap-1"
                >
                  <X size={13} /> Сбросить
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">УИН</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Наименование</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Округ</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Рук. проекта</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.slice(0, 50).map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-mono text-blue-700">{a["Код УИН"]}</td>
                          <td className="px-3 py-1.5 text-slate-800">{a["Наименование объекта"]}</td>
                          <td className="px-3 py-1.5 text-slate-600">{a["Городской округ"]}</td>
                          <td className="px-3 py-1.5 text-slate-500">{a["Руководитель проекта"] || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (
                    <p className="px-3 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                      Показано 50 из {preview.length} строк
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100/60 transition">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={e => setReplaceAll(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-600"
                />
                <span className="flex items-center gap-1.5 text-sm text-amber-800 font-medium">
                  <Trash2 size={14} /> Заменить весь справочник (удалить текущие данные перед загрузкой)
                </span>
              </label>

              {uploadError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}
            </>
          )}

          {/* Success */}
          {uploadResult && (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <CheckCircle size={48} className="text-emerald-500" />
              <p className="text-xl font-bold text-slate-900">Загрузка завершена!</p>
              <p className="text-slate-600">Загружено объектов: <strong>{uploadResult.inserted}</strong></p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition text-sm font-medium"
          >
            {uploadResult ? 'Закрыть' : 'Отмена'}
          </button>
          {preview && !uploadResult && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-medium disabled:opacity-60"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Загрузка...' : `Загрузить ${preview.length} объектов`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
