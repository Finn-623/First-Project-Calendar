-- Restrict admin read scope: admin can manage public foods, but cannot read other users' private foods.

DROP POLICY IF EXISTS foods_select_public_or_own_private_or_admin ON public.foods;

CREATE POLICY foods_select_public_or_own_private_or_admin
  ON public.foods
  FOR SELECT
  TO authenticated
  USING (
    (
      visibility = 'public'
      AND (
        is_active = TRUE
        OR public.is_app_admin(auth.uid())
      )
    )
    OR (
      visibility = 'private'
      AND user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
