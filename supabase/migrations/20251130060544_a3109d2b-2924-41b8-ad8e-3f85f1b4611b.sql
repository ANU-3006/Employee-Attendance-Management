-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::text::app_role
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Create invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  role app_role NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days') NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only managers can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- RLS policies for invitations
CREATE POLICY "Managers can view all invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can create invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Update attendance RLS policies to use has_role
DROP POLICY IF EXISTS "Employees can update their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can view their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Managers can delete attendance" ON public.attendance;

CREATE POLICY "Employees can update their own attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Employees can view their own attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Managers can delete attendance"
ON public.attendance
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'admin')
);