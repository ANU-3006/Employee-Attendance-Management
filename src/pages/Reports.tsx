import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileDown, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportToCSV } from "@/utils/csvExport";
import { Badge } from "@/components/ui/badge";

interface AttendanceRecord {
  id: string;
  date: string;
  user_id: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number | null;
  employee_name: string;
  employee_id: string;
  department: string;
}

const Reports = () => {
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadAttendanceData();
  }, [startDate, endDate, selectedEmployee]);

  const loadEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, employee_id")
      .order("name");
    
    if (data) {
      setEmployees(data);
    }
  };

  const loadAttendanceData = async () => {
    setLoading(true);
    
    let query = supabase
      .from("attendance")
      .select(`
        *,
        profiles!attendance_user_id_fkey (
          name,
          employee_id,
          department
        )
      `)
      .gte("date", format(startDate, "yyyy-MM-dd"))
      .lte("date", format(endDate, "yyyy-MM-dd"))
      .order("date", { ascending: false });

    if (selectedEmployee !== "all") {
      query = query.eq("user_id", selectedEmployee);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load attendance data");
    } else if (data) {
      const formattedData: AttendanceRecord[] = data.map((record: any) => ({
        id: record.id,
        date: record.date,
        user_id: record.user_id,
        status: record.status,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        total_hours: record.total_hours,
        employee_name: record.profiles?.name || "Unknown",
        employee_id: record.profiles?.employee_id || "N/A",
        department: record.profiles?.department || "N/A",
      }));
      setAttendanceData(formattedData);
    }
    
    setLoading(false);
  };

  const handleExportCSV = () => {
    const exportData = attendanceData.map(record => ({
      Date: format(new Date(record.date), "yyyy-MM-dd"),
      "Employee Name": record.employee_name,
      "Employee ID": record.employee_id,
      Department: record.department,
      Status: record.status,
      "Check In": record.check_in_time ? format(new Date(record.check_in_time), "HH:mm:ss") : "N/A",
      "Check Out": record.check_out_time ? format(new Date(record.check_out_time), "HH:mm:ss") : "N/A",
      "Total Hours": record.total_hours?.toFixed(2) || "N/A",
    }));

    const filename = selectedEmployee === "all" 
      ? "all_employees_attendance" 
      : `employee_${selectedEmployee}_attendance`;
    
    exportToCSV(exportData, filename);
    toast.success("Report exported successfully");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      present: "default",
      late: "secondary",
      absent: "destructive",
      "half-day": "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Attendance Reports</h2>
        <p className="text-muted-foreground">Generate and export attendance reports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Select date range and employee to generate report</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExportCSV} disabled={attendanceData.length === 0}>
              <FileDown className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>
            Showing {attendanceData.length} records from {format(startDate, "MMM d, yyyy")} to{" "}
            {format(endDate, "MMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : attendanceData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records found for the selected criteria
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Total Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium">{record.employee_name}</TableCell>
                      <TableCell>{record.employee_id}</TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {record.check_in_time
                          ? format(new Date(record.check_in_time), "h:mm a")
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {record.check_out_time
                          ? format(new Date(record.check_out_time), "h:mm a")
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {record.total_hours ? record.total_hours.toFixed(2) : "N/A"}
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

export default Reports;
