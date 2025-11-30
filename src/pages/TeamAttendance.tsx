import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Users, Download, Search, Edit } from "lucide-react";
import { toast } from "sonner";
import EditAttendanceDialog from "@/components/EditAttendanceDialog";
import { exportToCSV } from "@/utils/csvExport";

interface AttendanceWithProfile {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  total_hours: number | null;
  modified_by: string | null;
  modified_at: string | null;
  original_status: string | null;
  modification_reason: string | null;
  profiles: {
    name: string;
    employee_id: string;
    department: string;
  };
  modifier?: {
    name: string;
  } | null;
}

const TeamAttendance = () => {
  const [records, setRecords] = useState<AttendanceWithProfile[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceWithProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    record: AttendanceWithProfile | null;
  }>({ open: false, record: null });

  useEffect(() => {
    loadTeamAttendance();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = records.filter(
        (record) =>
          record.profiles.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.profiles.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.profiles.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRecords(filtered);
    } else {
      setFilteredRecords(records);
    }
  }, [searchTerm, records]);

  const loadTeamAttendance = async () => {
    const { data } = await supabase
      .from("attendance")
      .select(`
        *,
        profiles:user_id (
          name,
          employee_id,
          department
        ),
        modifier:modified_by (
          name
        )
      `)
      .order("date", { ascending: false })
      .limit(100);

    if (data) {
      setRecords(data as any);
      setFilteredRecords(data as any);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      present: "bg-success text-white hover:bg-success/90",
      absent: "bg-absent text-white hover:bg-absent/90",
      late: "bg-late text-white hover:bg-late/90",
      "half-day": "bg-half-day text-white hover:bg-half-day/90",
    };

    return (
      <Badge className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const handleExportCSV = () => {
    const exportData = filteredRecords.map((record) => ({
      Date: format(new Date(record.date), "yyyy-MM-dd"),
      "Employee ID": record.profiles.employee_id,
      Name: record.profiles.name,
      Department: record.profiles.department,
      Status: record.status,
      "Check In": record.check_in_time ? format(new Date(record.check_in_time), "HH:mm:ss") : "",
      "Check Out": record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "",
      "Total Hours": record.total_hours?.toFixed(2) || "",
    }));

    exportToCSV(exportData, "team_attendance_report");
    toast.success("Report exported successfully!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Team Attendance
          </h2>
          <p className="text-muted-foreground">View and manage team attendance records</p>
        </div>
        <Button onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>Search and filter attendance by employee or date</CardDescription>
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee ID, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No records found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{record.profiles.employee_id}</TableCell>
                      <TableCell>{record.profiles.name}</TableCell>
                      <TableCell>{record.profiles.department}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(record.status)}
                          {record.modified_by && (
                            <div className="text-xs text-muted-foreground">
                              {record.original_status && (
                                <p>
                                  Changed from{" "}
                                  <span className="font-medium capitalize">
                                    {record.original_status}
                                  </span>
                                </p>
                              )}
                              <p className="italic">
                                Modified by {record.modifier?.name || "Admin"}
                              </p>
                              {record.modification_reason && (
                                <p className="mt-1 text-xs italic">
                                  "{record.modification_reason}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.check_in_time
                          ? format(new Date(record.check_in_time), "h:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {record.check_out_time
                          ? format(new Date(record.check_out_time), "h:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {record.total_hours ? `${record.total_hours.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditDialog({ open: true, record })}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editDialog.record && (
        <EditAttendanceDialog
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog({ open, record: null })}
          record={editDialog.record}
          onSuccess={loadTeamAttendance}
        />
      )}
    </div>
  );
};

export default TeamAttendance;
