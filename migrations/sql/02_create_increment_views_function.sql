CREATE OR REPLACE FUNCTION increment_views(artwork_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_views INTEGER;
BEGIN
    UPDATE artworks
    SET views = COALESCE(views, 0) + 1
    WHERE id = artwork_id
    RETURNING views INTO new_views;

    RETURN new_views;
END;
$$;
