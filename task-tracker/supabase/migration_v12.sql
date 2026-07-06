-- Migration v12: normalize "Городской округ" in addresses table
-- 1. Trim leading/trailing whitespace from all values
-- 2. Fix known typos and encoding errors

UPDATE public.addresses SET "Городской округ" = TRIM("Городской округ")
WHERE "Городской округ" != TRIM("Городской округ");

-- Fix typo: Чезов → Чехов
UPDATE public.addresses SET "Городской округ" = 'Чехов'
WHERE "Городской округ" = 'Чезов';

-- Fix truncated: Серебряные → Серебряные Пруды
UPDATE public.addresses SET "Городской округ" = 'Серебряные Пруды'
WHERE "Городской округ" = 'Серебряные';

-- Fix broken encoding: ��Убна → Дубна
UPDATE public.addresses SET "Городской округ" = 'Дубна'
WHERE "Городской округ" LIKE '%убна' AND "Городской округ" != 'Дубна';

-- Fix case: Павлово-посадский → Павлово-Посадский
UPDATE public.addresses SET "Городской округ" = 'Павлово-Посадский'
WHERE "Городской округ" = 'Павлово-посадский';

-- Verify result
SELECT DISTINCT "Городской округ" FROM public.addresses ORDER BY "Городской округ";
