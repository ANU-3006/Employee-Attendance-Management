-- Add audit fields to attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS original_status TEXT,
ADD COLUMN IF NOT EXISTS modification_reason TEXT;

-- Create settings table for system configuration
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for settings
CREATE POLICY "Anyone can view settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can update settings"
ON public.settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Insert default late threshold setting (9:15 AM)
INSERT INTO public.settings (key, value)
VALUES ('late_threshold', '{"hours": 9, "minutes": 15}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add trigger for settings updated_at
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if time is late
CREATE OR REPLACE FUNCTION public.is_late_check_in(check_in_time TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  threshold_time TIME;
  check_in_time_only TIME;
  late_hours INT;
  late_minutes INT;
BEGIN
  -- Get late threshold from settings
  SELECT (value->>'hours')::INT, (value->>'minutes')::INT
  INTO late_hours, late_minutes
  FROM public.settings
  WHERE key = 'late_threshold';
  
  -- If no setting found, default to 9:15 AM
  IF late_hours IS NULL THEN
    late_hours := 9;
    late_minutes := 15;
  END IF;
  
  threshold_time := make_time(late_hours, late_minutes, 0);
  check_in_time_only := check_in_time::TIME;
  
  RETURN check_in_time_only > threshold_time;
END;
$$;

-- Add comment to attendance table for clarity
COMMENT ON COLUMN public.attendance.modified_by IS 'User ID of admin/manager who modified this record';
COMMENT ON COLUMN public.attendance.original_status IS 'Original status before admin modification';
COMMENT ON COLUMN public.attendance.modification_reason IS 'Reason provided by admin for the change';