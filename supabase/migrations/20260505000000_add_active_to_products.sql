-- Adiciona coluna 'active' para soft delete de produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
