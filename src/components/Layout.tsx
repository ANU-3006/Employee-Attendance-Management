import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, LayoutDashboard, Calendar, FileText, User, UserPlus, Settings as SettingsIcon, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager, isEmployee, loading } = useUserRole();
  const [userName, setUserName] = useState<string>("");
  const [displayRole, setDisplayRole] = useState<string>("");

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .maybeSingle();
        
        if (profile) {
          setUserName(profile.name);
        }
      }
    };
    getProfile();
  }, []);

  useEffect(() => {
    if (!loading) {
      if (isManager) setDisplayRole("manager");
      else if (isEmployee) setDisplayRole("employee");
    }
  }, [isManager, isEmployee, loading]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Clock className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Attendance System</h1>
              {userName && (
                <p className="text-xs text-muted-foreground">
                  Welcome, {userName} {displayRole && `(${displayRole})`}
                </p>
              )}
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            <Button
              variant={isActive("/") ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            {isEmployee && (
              <Button
                variant={isActive("/attendance") ? "default" : "ghost"}
                size="sm"
                asChild
              >
                <Link to="/attendance">
                  <Calendar className="w-4 h-4 mr-2" />
                  My Attendance
                </Link>
              </Button>
            )}
            {isManager && (
              <>
                <Button
                  variant={isActive("/team-attendance") ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link to="/team-attendance">
                    <FileText className="w-4 h-4 mr-2" />
                    Team Attendance
                  </Link>
                </Button>
                <Button
                  variant={isActive("/reports") ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link to="/reports">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Reports
                  </Link>
                </Button>
                <Button
                  variant={isActive("/invitations") ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link to="/invitations">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Team
                  </Link>
                </Button>
                <Button
                  variant={isActive("/settings") ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link to="/settings">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </Button>
              </>
            )}
            <Button
              variant={isActive("/profile") ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
};

export default Layout;
