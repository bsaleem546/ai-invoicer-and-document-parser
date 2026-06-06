-- enums
CREATE TYPE public.team_role AS ENUM ('owner', 'member');
CREATE TYPE public.invite_status AS ENUM ('pending', 'active');

-- teams table (no policies yet)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- team_members table (no policies yet)
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX team_members_team_email_idx ON public.team_members(team_id, invited_email);
CREATE INDEX team_members_user_idx ON public.team_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- now add teams policies (can safely reference team_members now)
CREATE POLICY "team members can view" ON public.teams FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );
CREATE POLICY "owner can update" ON public.teams FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner can insert" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- team_members policies
CREATE POLICY "team members can view their team" ON public.team_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND (
        t.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.team_members tm2 WHERE tm2.team_id = t.id AND tm2.user_id = auth.uid() AND tm2.status = 'active')
      )
    )
  );
CREATE POLICY "owner can manage members" ON public.team_members FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

-- add team_id to profiles
ALTER TABLE public.profiles ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- helper: get team_id for a user
CREATE OR REPLACE FUNCTION public.get_user_team_id(uid UUID)
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT id FROM public.teams WHERE owner_id = uid LIMIT 1),
    (SELECT team_id FROM public.team_members WHERE user_id = uid AND status = 'active' LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- update documents RLS
DROP POLICY IF EXISTS "own documents all" ON public.documents;
CREATE POLICY "own documents all" ON public.documents FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR (
      public.get_user_team_id(auth.uid()) IS NOT NULL AND
      user_id IN (
        SELECT tm.user_id FROM public.team_members tm
        WHERE tm.team_id = public.get_user_team_id(auth.uid()) AND tm.status = 'active' AND tm.user_id IS NOT NULL
        UNION
        SELECT t.owner_id FROM public.teams t WHERE t.id = public.get_user_team_id(auth.uid())
      )
    )
  )
  WITH CHECK (user_id = auth.uid());

-- update extracted_data RLS
DROP POLICY IF EXISTS "own extracted_data all" ON public.extracted_data;
CREATE POLICY "own extracted_data all" ON public.extracted_data FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d WHERE d.id = document_id AND (
      d.user_id = auth.uid() OR (
        public.get_user_team_id(auth.uid()) IS NOT NULL AND
        d.user_id IN (
          SELECT tm.user_id FROM public.team_members tm
          WHERE tm.team_id = public.get_user_team_id(auth.uid()) AND tm.status = 'active' AND tm.user_id IS NOT NULL
          UNION
          SELECT t.owner_id FROM public.teams t WHERE t.id = public.get_user_team_id(auth.uid())
        )
      )
    )
  ))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid()));

-- update line_items RLS
DROP POLICY IF EXISTS "own line_items all" ON public.line_items;
CREATE POLICY "own line_items all" ON public.line_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d WHERE d.id = document_id AND (
      d.user_id = auth.uid() OR (
        public.get_user_team_id(auth.uid()) IS NOT NULL AND
        d.user_id IN (
          SELECT tm.user_id FROM public.team_members tm
          WHERE tm.team_id = public.get_user_team_id(auth.uid()) AND tm.status = 'active' AND tm.user_id IS NOT NULL
          UNION
          SELECT t.owner_id FROM public.teams t WHERE t.id = public.get_user_team_id(auth.uid())
        )
      )
    )
  ))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid()));

-- update duplicate_flags RLS
DROP POLICY IF EXISTS "own duplicate_flags all" ON public.duplicate_flags;
CREATE POLICY "own duplicate_flags all" ON public.duplicate_flags FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d WHERE d.id = document_id AND (
      d.user_id = auth.uid() OR (
        public.get_user_team_id(auth.uid()) IS NOT NULL AND
        d.user_id IN (
          SELECT tm.user_id FROM public.team_members tm
          WHERE tm.team_id = public.get_user_team_id(auth.uid()) AND tm.status = 'active' AND tm.user_id IS NOT NULL
          UNION
          SELECT t.owner_id FROM public.teams t WHERE t.id = public.get_user_team_id(auth.uid())
        )
      )
    )
  ))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid()));
