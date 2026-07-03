-- Fix evaluations table column nullability for partial submissions
ALTER TABLE public.evaluations ALTER COLUMN technical_quality DROP NOT NULL;
ALTER TABLE public.evaluations ALTER COLUMN deadline DROP NOT NULL;
ALTER TABLE public.evaluations ALTER COLUMN briefing_adherence DROP NOT NULL;
ALTER TABLE public.evaluations ALTER COLUMN communication DROP NOT NULL;
ALTER TABLE public.evaluations ALTER COLUMN autonomy DROP NOT NULL;
ALTER TABLE public.evaluations ALTER COLUMN behavior DROP NOT NULL;
