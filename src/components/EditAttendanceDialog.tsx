import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";

const editSchema = z.object({
  status: z.enum(["present", "absent", "late", "half-day"]),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(500),
});

interface EditAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: {
    id: string;
    status: string;
    profiles: {
      name: string;
      employee_id: string;
    };
  };
  onSuccess: () => void;
}

const EditAttendanceDialog = ({ open, onOpenChange, record, onSuccess }: EditAttendanceDialogProps) => {
  const [status, setStatus] = useState(record.status);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const validated = editSchema.parse({ status, reason });
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase
        .from("attendance")
        .update({
          status: validated.status,
          modified_by: user.id,
          modified_at: new Date().toISOString(),
          original_status: record.status !== validated.status ? record.status : null,
          modification_reason: validated.reason,
        })
        .eq("id", record.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Attendance record updated successfully!");
        onOpenChange(false);
        onSuccess();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to update record");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Attendance Record</DialogTitle>
          <DialogDescription>
            Modify attendance for {record.profiles.name} ({record.profiles.employee_id})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="half-day">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you're modifying this record..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This will be visible to all users viewing this attendance record
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAttendanceDialog;
