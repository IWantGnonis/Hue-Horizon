-- Add price column to artworks table
ALTER TABLE artworks
ADD COLUMN price DECIMAL(10,2);

-- Add an index on price for better marketplace query performance
CREATE INDEX idx_artworks_price ON artworks(price);

-- Add RLS policy for price
ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public users can view priced artworks" 
ON artworks
FOR SELECT
USING (price IS NOT NULL AND price > 0);

CREATE POLICY "Users can update price of their own artworks" 
ON artworks
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id); 