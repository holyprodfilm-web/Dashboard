-- Migration v14: fix remaining single-character corruption (U+FFFD replacement character)

-- "Д<?>итровский" → Дмитровский  (one corrupted char between Д and итровский)
UPDATE public.addresses
SET "Городской округ" = 'Дмитровский'
WHERE "Городской округ" SIMILAR TO 'Д_итровский';

-- "Павлово-<?>осадский" → Павлово-Посадский  (one corrupted char between - and осадский)
UPDATE public.addresses
SET "Городской округ" = 'Павлово-Посадский'
WHERE "Городской округ" SIMILAR TO 'Павлово-_осадский';
