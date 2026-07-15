CREATE POLICY "ai_actions read own" ON public.ai_actions
FOR SELECT
USING (user_id = auth.uid());