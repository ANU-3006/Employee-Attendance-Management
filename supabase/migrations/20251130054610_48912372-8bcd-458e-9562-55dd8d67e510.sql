-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('employee', 'manager');

-- Create attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'half-day');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  employee_id TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  status public.attendance_status NOT NULL DEFAULT 'present',
  total_hours DECIMAL(4,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Attendance policies for employees (view own attendance)
CREATE POLICY "Employees can view their own attendance"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- Employees can insert their own attendance
CREATE POLICY "Employees can insert their own attendance"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Employees can update their own attendance
CREATE POLICY "Employees can update their own attendance"
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- Managers can delete attendance records
CREATE POLICY "Managers can delete attendance"
  ON public.attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
    )
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, employee_id, department, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    'EMP' || LPAD(nextval('employee_id_seq')::TEXT, 4, '0'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
  );
  RETURN NEW;
END;
$$;

-- Create sequence for employee IDs
CREATE SEQUENCE IF NOT EXISTS employee_id_seq START 1;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update total hours
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to calculate total hours
CREATE TRIGGER calculate_attendance_hours
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_hours();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();