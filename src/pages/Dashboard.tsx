import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, UserCheck, Users, AlertCircle, TrendingUp, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface Stats {
  todayStatus: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalHours: number;
}

interface ManagerStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  weeklyTrend: Array<{ date: string; present: number; absent: number; late: number }>;
  attendanceDistribution: Array<{ name: string; value: number }>;
}

const Dashboard = () => {
  const { isManager, isEmployee, loading: roleLoading } = useUserRole();
  const [stats, setStats] = useState<Stats | null>(null);
  const [managerStats, setManagerStats] = useState<ManagerStats | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading) {
      loadData();
    }
  }, [roleLoading, isEmployee, isManager]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isEmployee) {
      await loadEmployeeStats(user.id);
    } else if (isManager) {
      await loadManagerStats();
    }
    setLoading(false);
  };

  const loadEmployeeStats = async (userId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data: todayRecord } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    setTodayAttendance(todayRecord);

    const { data: monthRecords } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .gte("date", firstDayOfMonth)
      .lte("date", today);

    if (monthRecords) {
      const presentDays = monthRecords.filter((r) => r.status === "present").length;
      const absentDays = monthRecords.filter((r) => r.status === "absent").length;
      const lateDays = monthRecords.filter((r) => r.status === "late").length;
      const totalHours = monthRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);

      setStats({
        todayStatus: todayRecord ? todayRecord.status : "not marked",
        presentDays,
        absentDays,
        lateDays,
        totalHours,
      });
    }
  };

  const loadManagerStats = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { count: totalEmployees } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employee");

    const { data: todayRecords } = await supabase
      .from("attendance")
      .select("status")
      .eq("date", today);

    // Get last 7 days data for trend
    const sevenDaysAgo = subDays(new Date(), 6).toISOString().split("T")[0];
    const { data: weekRecords } = await supabase
      .from("attendance")
      .select("date, status")
      .gte("date", sevenDaysAgo)
      .lte("date", today);

    // Process weekly trend
    const weeklyTrend: Array<{ date: string; present: number; absent: number; late: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i).toISOString().split("T")[0];
      const dayRecords = weekRecords?.filter((r) => r.date === date) || [];
      weeklyTrend.push({
        date: format(new Date(date), "MMM dd"),
        present: dayRecords.filter((r) => r.status === "present").length,
        absent: dayRecords.filter((r) => r.status === "absent").length,
        late: dayRecords.filter((r) => r.status === "late").length,
      });
    }

    // Get month data for distribution
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const { data: monthRecords } = await supabase
      .from("attendance")
      .select("status")
      .gte("date", firstDayOfMonth)
      .lte("date", today);

    const attendanceDistribution = [
      { name: "Present", value: monthRecords?.filter((r) => r.status === "present").length || 0 },
      { name: "Late", value: monthRecords?.filter((r) => r.status === "late").length || 0 },
      { name: "Absent", value: monthRecords?.filter((r) => r.status === "absent").length || 0 },
    ];

    if (todayRecords) {
      const presentToday = todayRecords.filter((r) => r.status === "present").length;
      const absentToday = todayRecords.filter((r) => r.status === "absent").length;
      const lateToday = todayRecords.filter((r) => r.status === "late").length;

      setManagerStats({
        totalEmployees: totalEmployees || 0,
        presentToday,
        absentToday,
        lateToday,
        weeklyTrend,
        attendanceDistribution,
      });
    }
  };

  const handleCheckIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    // Call the database function to check if late
    const { data: isLate } = await supabase.rpc("is_late_check_in", {
      check_in_time: now,
    });

    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      date: today,
      check_in_time: now,
      status: isLate ? "late" : "present",
    });

    if (error) {
      toast.error(error.message);
    } else {
      if (isLate) {
        toast.warning("Checked in late!");
      } else {
        toast.success("Checked in successfully!");
      }
      loadData();
    }
  };

  const handleCheckOut = async () => {
    if (!todayAttendance) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("attendance")
      .update({ check_out_time: now })
      .eq("id", todayAttendance.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Checked out successfully!");
      loadData();
    }
  };

  if (loading || roleLoading) {
    return <div className="text-center">Loading...</div>;
  }

  if (isEmployee) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Employee Dashboard</h2>
          <p className="text-muted-foreground">Track your attendance and hours</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>{format(new Date(), "EEEE, MMMM d, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!todayAttendance ? (
              <div className="flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-warning" />
                <p>You haven't checked in yet today</p>
                <Button onClick={handleCheckIn}>Check In</Button>
              </div>
            ) : todayAttendance.check_out_time ? (
              <div className="space-y-2">
                <p className="text-success flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Checked in and out for today
                </p>
                <div className="text-sm text-muted-foreground">
                  <p>Check in: {format(new Date(todayAttendance.check_in_time), "h:mm a")}</p>
                  <p>Check out: {format(new Date(todayAttendance.check_out_time), "h:mm a")}</p>
                  {todayAttendance.total_hours && (
                    <p>Total hours: {todayAttendance.total_hours.toFixed(2)}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-primary flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Checked in at {format(new Date(todayAttendance.check_in_time), "h:mm a")}
                </p>
                <Button onClick={handleCheckOut}>Check Out</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Days</CardTitle>
                <UserCheck className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.presentDays}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
                <AlertCircle className="h-4 w-4 text-absent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.absentDays}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Late Days</CardTitle>
                <Clock className="h-4 w-4 text-late" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.lateDays}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  if (isManager) {
    const COLORS = ["hsl(var(--success))", "hsl(var(--late))", "hsl(var(--absent))"];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Manager Dashboard</h2>
          <p className="text-muted-foreground">Monitor team attendance and performance</p>
        </div>

        {managerStats && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{managerStats.totalEmployees}</div>
                  <p className="text-xs text-muted-foreground">In your team</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                  <UserCheck className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{managerStats.presentToday}</div>
                  <p className="text-xs text-muted-foreground">
                    {managerStats.totalEmployees > 0
                      ? ((managerStats.presentToday / managerStats.totalEmployees) * 100).toFixed(0)
                      : 0}
                    % attendance
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
                  <AlertCircle className="h-4 w-4 text-absent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{managerStats.absentToday}</div>
                  <p className="text-xs text-muted-foreground">Not checked in</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Late Today</CardTitle>
                  <Clock className="h-4 w-4 text-late" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{managerStats.lateToday}</div>
                  <p className="text-xs text-muted-foreground">Late arrivals</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Weekly Attendance Trend
                  </CardTitle>
                  <CardDescription>Last 7 days attendance overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      present: { label: "Present", color: "hsl(var(--success))" },
                      late: { label: "Late", color: "hsl(var(--late))" },
                      absent: { label: "Absent", color: "hsl(var(--absent))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={managerStats.weeklyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="present"
                          stroke="hsl(var(--success))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--success))" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="late"
                          stroke="hsl(var(--late))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--late))" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="absent"
                          stroke="hsl(var(--absent))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--absent))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Monthly Distribution
                  </CardTitle>
                  <CardDescription>Attendance breakdown this month</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      Present: { label: "Present", color: "hsl(var(--success))" },
                      Late: { label: "Late", color: "hsl(var(--late))" },
                      Absent: { label: "Absent", color: "hsl(var(--absent))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={managerStats.attendanceDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {managerStats.attendanceDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};

export default Dashboard;
