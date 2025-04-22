-- Function to disable RLS for a table
CREATE OR REPLACE FUNCTION public.disable_rls_for_table(table_name text)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
END;
$$;

-- Function to enable RLS for a table
CREATE OR REPLACE FUNCTION public.enable_rls_for_table(table_name text)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
END;
$$;
