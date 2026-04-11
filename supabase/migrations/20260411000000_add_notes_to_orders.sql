-- Add notes column to orders table for customer observations
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
