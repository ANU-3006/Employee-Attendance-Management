import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (data) {
        setRoles(data.map(r => r.role));
      }
      setLoading(false);
    };

    loadRoles();
  }, []);

  const hasRole = (role: string) => roles.includes(role);
  const isManager = hasRole("manager") || hasRole("admin");
  const isEmployee = hasRole("employee");

  return { roles, hasRole, isManager, isEmployee, loading };
};
