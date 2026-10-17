-- Optional: if group_messages has RLS enabled, members need read/write policies.

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_messages_select_member" ON public.group_messages;
CREATE POLICY "group_messages_select_member"
  ON public.group_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_memberships gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "group_messages_insert_member" ON public.group_messages;
CREATE POLICY "group_messages_insert_member"
  ON public.group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.group_memberships gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = auth.uid()
    )
  );
