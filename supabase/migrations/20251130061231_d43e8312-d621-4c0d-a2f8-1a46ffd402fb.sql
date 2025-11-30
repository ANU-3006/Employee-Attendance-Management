-- Update handle_new_user function to create user_roles entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, name, email, employee_id, department, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    'EMP' || LPAD(nextval('employee_id_seq')::TEXT, 4, '0'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
  );
  
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'employee')
  );
  
  RETURN NEW;
END;
$function$;