-- Add financial calculation columns to shortlist_candidates
ALTER TABLE public.shortlist_candidates
ADD COLUMN IF NOT EXISTS negotiated_total numeric(12,2),
ADD COLUMN IF NOT EXISTS budget_saving_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS budget_saving_percentage numeric(5,2),
ADD COLUMN IF NOT EXISTS daily_budget_reference numeric(12,2),
ADD COLUMN IF NOT EXISTS daily_saving_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS budget_delta_status text DEFAULT 'not_calculated',
ADD COLUMN IF NOT EXISTS estimated_hours numeric(10,2);

-- Add financial calculation columns to allocations
ALTER TABLE public.allocations
ADD COLUMN IF NOT EXISTS negotiated_total numeric(12,2),
ADD COLUMN IF NOT EXISTS budget_saving_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS budget_saving_percentage numeric(5,2),
ADD COLUMN IF NOT EXISTS daily_budget_reference numeric(12,2),
ADD COLUMN IF NOT EXISTS daily_saving_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS budget_delta_status text DEFAULT 'not_calculated',
ADD COLUMN IF NOT EXISTS estimated_hours numeric(10,2);
