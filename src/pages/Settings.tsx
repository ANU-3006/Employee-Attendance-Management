import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const timeSchema = z.object({
  hours: z.number().min(0).max(23),
  minutes: z.number().min(0).max(59),
});

const Settings = () => {
  const [lateThreshold, setLateThreshold] = useState({ hours: 9, minutes: 15 });
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "late_threshold")
      .maybeSingle();

    if (data?.value) {
      const threshold = data.value as { hours: number; minutes: number };
      setLateThreshold({
        hours: threshold.hours,
        minutes: threshold.minutes,
      });
    }
    setInitialLoad(false);
  };

  const handleSave = async () => {
    try {
      const validated = timeSchema.parse(lateThreshold);
      setLoading(true);

      const { error } = await supabase
        .from("settings")
        .update({
          value: validated,
        })
        .eq("key", "late_threshold");

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Settings saved successfully!");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error("Invalid time format");
      } else {
        toast.error("Failed to save settings");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hours: number, minutes: number) => {
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  if (initialLoad) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-8 h-8" />
          System Settings
        </h2>
        <p className="text-muted-foreground">Configure attendance system settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Late Arrival Threshold</CardTitle>
          <CardDescription>
            Set the time after which check-ins are automatically marked as late
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Current Threshold</p>
              <p className="text-2xl font-bold text-primary">
                {formatTime(lateThreshold.hours, lateThreshold.minutes)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Employees checking in after this time will be marked as late
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hours">Hours (0-23)</Label>
              <Input
                id="hours"
                type="number"
                min="0"
                max="23"
                value={lateThreshold.hours}
                onChange={(e) =>
                  setLateThreshold({
                    ...lateThreshold,
                    hours: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutes">Minutes (0-59)</Label>
              <Input
                id="minutes"
                type="number"
                min="0"
                max="59"
                value={lateThreshold.minutes}
                onChange={(e) =>
                  setLateThreshold({
                    ...lateThreshold,
                    minutes: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={loading} className="w-full md:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Late Marking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Employees who check in after the threshold time will automatically have their
            status set to "late"
          </p>
          <p>
            • Managers can manually edit attendance records to change status if needed
          </p>
          <p>
            • All modifications by managers are tracked and visible in the attendance records
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
