-- ads_agent_ro can read every marketing table EXCEPT marketing_apply_gate,
-- because that table was created (20260828140000) after the role's grants
-- (20260821120000) and RLS policies (20260828120000) were written. The agent
-- watching the live Snap lead campaign hit "permission denied" on its first
-- poll, 2026-08-29. Same posture as the other marketing tables: SELECT only,
-- plus the RLS policy the role's other reads carry.

grant select on public.marketing_apply_gate to ads_agent_ro;

drop policy if exists ads_agent_ro_read_apply_gate on public.marketing_apply_gate;
create policy ads_agent_ro_read_apply_gate
  on public.marketing_apply_gate for select
  to ads_agent_ro
  using (true);
