import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Mail } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [invitationData, setInvitationData] = useState<{
    email: string;
    name: string;
    department: string;
    role: string;
    token: string;
  } | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    const inviteToken = searchParams.get("invite");
    if (inviteToken) {
      loadInvitation(inviteToken);
    }
  }, [searchParams]);

  const loadInvitation = async (token: string) => {
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (error || !data) {
      toast.error("Invalid or expired invitation");
      return;
    }

    // Check if invitation is expired
    if (new Date(data.expires_at) < new Date()) {
      toast.error("This invitation has expired");
      return;
    }

    setInvitationData({
      email: data.email,
      name: data.name,
      department: data.department,
      role: data.role,
      token: data.token,
    });
    toast.info("You've been invited! Please create your password to continue.");
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const name = invitationData?.name || (formData.get("name") as string);
    const email = invitationData?.email || (formData.get("email") as string);
    const password = formData.get("password") as string;
    const department = invitationData?.department || (formData.get("department") as string);
    const role = invitationData?.role || (formData.get("role") as string);

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          name,
          department,
          role,
        },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // If this is from an invitation, update invitation status and create user_role
    if (invitationData && authData.user) {
      await supabase
        .from("invitations")
        .update({ status: "accepted" })
        .eq("token", invitationData.token);

      // Create user role entry
      await supabase
        .from("user_roles")
        .insert([{
          user_id: authData.user.id,
          role: invitationData.role as "employee" | "manager" | "admin",
        }]);
    }

    setLoading(false);
    toast.success("Account created successfully!");
    navigate("/");
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed in successfully!");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary rounded-lg">
              <Clock className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Employee Attendance</CardTitle>
          <CardDescription>Sign in or create an account to track attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {invitationData && (
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Mail className="w-4 h-4" />
                      <p className="font-medium">You've been invited!</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invitationData.name} • {invitationData.department} • {invitationData.role}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    defaultValue={invitationData?.name}
                    disabled={!!invitationData}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    defaultValue={invitationData?.email}
                    disabled={!!invitationData}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                {!invitationData && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signup-department">Department</Label>
                      <Input
                        id="signup-department"
                        name="department"
                        type="text"
                        placeholder="Engineering"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-role">Role</Label>
                      <Select name="role" defaultValue="employee" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
