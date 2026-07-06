-- Migration v13: fix remaining broken district names

-- Fix broken encoding: Д??итровский → Дмитровский
UPDATE public.addresses SET "Городской округ" = 'Дмитровский'
WHERE "Городской округ" LIKE 'Д%итровский' AND "Городской округ" != 'Дмитровский';

-- Fix wrong case: ДУбна → Дубна
UPDATE public.addresses SET "Городской округ" = 'Дубна'
WHERE LOWER("Городской округ") = 'дубна' AND "Городской округ" != 'Дубна';

-- Fix Павлово-Посадский missing (may have been stored differently)
UPDATE public.addresses SET "Городской округ" = 'Павлово-Посадский'
WHERE LOWER("Городской округ") = 'павлово-посадский' AND "Городской округ" != 'Павлово-Посадский';

-- Clear empty/whitespace-only values
UPDATE public.addresses SET "Городской округ" = NULL
WHERE TRIM(COALESCE("Городской округ", '')) = '';
