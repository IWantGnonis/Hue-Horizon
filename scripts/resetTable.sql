-- Function to completely reset a table and its sequence
CREATE OR REPLACE FUNCTION public.reset_table_and_sequence(
    table_name text,
    sequence_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', table_name);
    EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', sequence_name);
END;
$$;
