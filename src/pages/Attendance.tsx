import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  total_hours: number | null;
}

const Attendance = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [monthlyStats, setMonthlyStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttendance();
  }, [selectedMonth]);

  const loadAttendance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd"))
      .order("date", { ascending: false });

    if (data) {
      setRecords(data);
      
      // Calculate monthly stats
      setMonthlyStats({
        present: data.filter((r) => r.status === "present").length,
        absent: data.filter((r) => r.status === "absent").length,
        late: data.filter((r) => r.status === "late").length,
        halfDay: data.filter((r) => r.status === "half-day").length,
      });
    }
    setLoading(false);
  };

  const getDateStatus = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const record = records.find((r) => r.date === dateStr);
    return record?.status;
  };

  const getSelectedDateRecord = () => {
    if (!selectedDate) return null;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return records.find((r) => r.date === dateStr);
  };

  const getDayClassName = (date: Date) => {
    const status = getDateStatus(date);
    if (!status) return "";

    const statusColors: Record<string, string> = {
      present: "bg-success text-white hover:bg-success/90",
      absent: "bg-absent text-white hover:bg-absent/90",
      late: "bg-late text-white hover:bg-late/90",
      "half-day": "bg-half-day text-white hover:bg-half-day/90",
    };

    return statusColors[status] || "";
  };

  const selectedRecord = getSelectedDateRecord();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-8 h-8" />
            My Attendance History
          </h2>
          <p className="text-muted-foreground">View your attendance calendar and records</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attendance Calendar</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(selectedMonth, "MMMM yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>Click on a date to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              className="rounded-md border pointer-events-auto"
              modifiers={{
                present: (date) => getDateStatus(date) === "present",
                absent: (date) => getDateStatus(date) === "absent",
                late: (date) => getDateStatus(date) === "late",
                halfDay: (date) => getDateStatus(date) === "half-day",
              }}
              modifiersClassNames={{
                present: "bg-success text-white hover:bg-success/90",
                absent: "bg-absent text-white hover:bg-absent/90",
                late: "bg-late text-white hover:bg-late/90",
                halfDay: "bg-half-day text-white hover:bg-half-day/90",
              }}
            />
            
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Color Legend:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-success" />
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-late" />
                  <span>Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-absent" />
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-half-day" />
                  <span>Half Day</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Summary</CardTitle>
              <CardDescription>{format(selectedMonth, "MMMM yyyy")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Present Days</span>
                    <Badge className="bg-success text-white">{monthlyStats.present}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Late Days</span>
                    <Badge className="bg-late text-white">{monthlyStats.late}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Absent Days</span>
                    <Badge className="bg-absent text-white">{monthlyStats.absent}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Half Days</span>
                    <Badge className="bg-half-day text-white">{monthlyStats.halfDay}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedDate && selectedRecord && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Date Details</CardTitle>
                <CardDescription>{format(selectedDate, "MMMM d, yyyy")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge
                      className={cn(
                        selectedRecord.status === "present" && "bg-success text-white",
                        selectedRecord.status === "late" && "bg-late text-white",
                        selectedRecord.status === "absent" && "bg-absent text-white",
                        selectedRecord.status === "half-day" && "bg-half-day text-white"
                      )}
                    >
                      {selectedRecord.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Check In</span>
                    <span className="text-sm font-medium">
                      {selectedRecord.check_in_time
                        ? format(new Date(selectedRecord.check_in_time), "h:mm a")
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Check Out</span>
                    <span className="text-sm font-medium">
                      {selectedRecord.check_out_time
                        ? format(new Date(selectedRecord.check_out_time), "h:mm a")
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Hours</span>
                    <span className="text-sm font-medium">
                      {selectedRecord.total_hours
                        ? `${selectedRecord.total_hours.toFixed(2)} hrs`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedDate && !selectedRecord && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Date Details</CardTitle>
                <CardDescription>{format(selectedDate, "MMMM d, yyyy")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No attendance record for this date</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
