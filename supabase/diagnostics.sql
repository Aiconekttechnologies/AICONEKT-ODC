-- ============================================================================
-- AICONEXT / AICONEKT TECHNOLOGIES — Read-Only Database Schema Diagnostics
-- Run this in the Supabase SQL Editor to check table and permission status
-- ============================================================================

SELECT
  t.table_name,
  CASE
    WHEN t.table_name IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING'
  END AS table_status,
  COALESCE(string_agg(c.column_name, ', ' ORDER BY c.ordinal_position), 'NO_COLUMNS') AS column_list
FROM (
  VALUES
    ('admin_users'),
    ('team_invitations'),
    ('team_members'),
    ('event_participants'),
    ('projects'),
    ('events'),
    ('contact_inquiries'),
    ('career_applications')
) AS req(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = req.table_name
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = req.table_name
GROUP BY t.table_name, req.table_name
ORDER BY req.table_name;
