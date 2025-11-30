import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Briefcase, Building, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Profile {
  name: string;
  email: string;
  employee_id: string;
  department: string;
  role: string;
  created_at: string;
}

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);
      setName(data.name);
      setDepartment(data.department);
    }
    setLoading(false);
  };

  const handleUpdate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ name, department })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated successfully!");
      setEditing(false);
      loadProfile();
    }
  };

  if (loading || !profile) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <User className="w-8 h-8" />
          My Profile
        </h2>
        <p className="text-muted-foreground">View and manage your profile information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your employee details and account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary rounded-full">
                <User className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{profile.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize">
                    {profile.role}
                  </Badge>
                  <Badge variant="secondary">{profile.employee_id}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 pt-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdate}>Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Mail className="w-5 h-5" />
                    <span>{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Building className="w-5 h-5" />
                    <span>{profile.department}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Briefcase className="w-5 h-5" />
                    <span className="capitalize">{profile.role}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="w-5 h-5" />
                    <span>Joined {format(new Date(profile.created_at), "MMMM yyyy")}</span>
                  </div>
                  <Button onClick={() => setEditing(true)} className="mt-4">
                    Edit Profile
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
