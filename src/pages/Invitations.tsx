import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";

const invitationSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  name: z.string().trim().min(1, "Name is required").max(100),
  department: z.string().trim().min(1, "Department is required").max(100),
  role: z.enum(["employee", "manager", "admin"]),
});

interface Invitation {
  id: string;
  email: string;
  name: string;
  department: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const Invitations = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    department: "",
    role: "employee",
  });

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setInvitations(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = invitationSchema.parse(formData);
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { data, error } = await supabase
        .from("invitations")
        .insert({
          email: validated.email,
          name: validated.name,
          department: validated.department,
          role: validated.role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Invitation sent successfully!");
        setFormData({ email: "", name: "", department: "", role: "employee" });
        loadInvitations();
        
        // Copy invitation link to clipboard
        const inviteLink = `${window.location.origin}/auth?invite=${data.token}`;
        navigator.clipboard.writeText(inviteLink);
        toast.info("Invitation link copied to clipboard!");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to send invitation");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteLink = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success("Invitation link copied!");
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (new Date(expiresAt) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    const colors: Record<string, string> = {
      pending: "bg-warning text-white hover:bg-warning/90",
      accepted: "bg-success text-white hover:bg-success/90",
      expired: "bg-absent text-white hover:bg-absent/90",
    };

    return (
      <Badge className={colors[status] || ""}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="w-8 h-8" />
          Team Invitations
        </h2>
        <p className="text-muted-foreground">Invite new team members to join</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send New Invitation</CardTitle>
          <CardDescription>Invite a new team member by email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Engineering"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              <Mail className="w-4 h-4 mr-2" />
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitation History</CardTitle>
          <CardDescription>View and manage sent invitations</CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No invitations sent yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.name}</TableCell>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>{invitation.department}</TableCell>
                      <TableCell className="capitalize">{invitation.role}</TableCell>
                      <TableCell>{getStatusBadge(invitation.status, invitation.expires_at)}</TableCell>
                      <TableCell>
                        {format(new Date(invitation.expires_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        {invitation.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invitation.token)}
                          >
                            {copiedToken === invitation.token ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Invitations;
