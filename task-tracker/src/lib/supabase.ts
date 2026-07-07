import { createClient } from '@supabase/supabase-js';

// В продакшн-сборке VITE_API_URL = адрес VPS (прокси к Supabase)
// В dev-среде используется прямой VITE_SUPABASE_URL
const supabaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Не заданы переменные окружения VITE_SUPABASE_ANON_KEY и ' +
    'VITE_SUPABASE_URL (или VITE_API_URL для прокси-режима). ' +
    'Скопируйте .env.example в .env и заполните значения.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
