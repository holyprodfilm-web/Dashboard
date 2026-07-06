-- Migration v15: enable pg_cron and set up nightly backup at 23:00 MSK (20:00 UTC)

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Backup function: snapshots all key tables into database_backups
CREATE OR REPLACE FUNCTION public.run_nightly_backup()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_data     jsonb;
  v_summary  jsonb;
  v_size     integer;
  v_filename text;
BEGIN
  v_filename := 'backup_' || to_char(NOW() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD_HH24-MI') || '_MSK.json';

  SELECT jsonb_build_object(
    'created_at', NOW(),
    'tables', jsonb_build_object(
      'addresses',           (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM addresses t),
      'closure_objects',     (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM closure_objects t),
      'closure_changes',     (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM closure_changes t),
      'tasks',               (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM tasks t),
      'task_links',          (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM task_links t),
      'meetings',            (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM meetings t),
      'meeting_attachments', (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM meeting_attachments t),
      'profiles',            (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM profiles t),
      'role_permissions',    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM role_permissions t)
    )
  ) INTO v_data;

  SELECT jsonb_build_object(
    'addresses',           (SELECT COUNT(*) FROM addresses),
    'closure_objects',     (SELECT COUNT(*) FROM closure_objects),
    'closure_changes',     (SELECT COUNT(*) FROM closure_changes),
    'tasks',               (SELECT COUNT(*) FROM tasks),
    'task_links',          (SELECT COUNT(*) FROM task_links),
    'meetings',            (SELECT COUNT(*) FROM meetings),
    'meeting_attachments', (SELECT COUNT(*) FROM meeting_attachments),
    'profiles',            (SELECT COUNT(*) FROM profiles),
    'role_permissions',    (SELECT COUNT(*) FROM role_permissions)
  ) INTO v_summary;

  v_size := length(v_data::text);

  INSERT INTO public.database_backups (filename, size_bytes, tables_summary, data)
  VALUES (v_filename, v_size, v_summary, v_data);

  -- Keep only last 30 backups
  DELETE FROM public.database_backups
  WHERE id NOT IN (
    SELECT id FROM public.database_backups
    ORDER BY created_at DESC
    LIMIT 30
  );

  RAISE NOTICE 'Backup completed: % (% bytes)', v_filename, v_size;
END;
$$;

-- 3. Schedule: every day at 20:00 UTC = 23:00 Moscow time
SELECT cron.schedule(
  'nightly-backup',        -- job name
  '0 20 * * *',            -- cron: 20:00 UTC every day
  'SELECT public.run_nightly_backup()'
);
