-- Add name column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update existing orders to have a default name if they don't have one
UPDATE public.orders 
SET name = 'Order #' || SUBSTRING(id::text, 1, 8)
WHERE name IS NULL;

-- Make name NOT NULL after migration
ALTER TABLE public.orders 
ALTER COLUMN name SET NOT NULL;
