-- Create a temporary SQL execution function for RLS configuration
-- This function allows executing arbitrary SQL statements
-- WARNING: This is a security-sensitive function and should be restricted

CREATE OR REPLACE FUNCTION public.exec_sql(sql_statement text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_statement;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Revoke from public
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM authenticated;
