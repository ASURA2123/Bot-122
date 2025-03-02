import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";

interface Stats {
  timeline: {
    timestamp: string;
    messageCount: number;
    activeUsers: number;
    commandUsage: number;
  }[];
  topCommands: {
    command: string;
    count: number;
  }[];
  userActivity: {
    hour: number;
    count: number;
  }[];
}

export function StatsTab() {
  const { data: stats } = useQuery({
    queryKey: ['/api/bot/detailed-stats'],
    queryFn: async () => {
      const res = await fetch('/api/bot/detailed-stats');
      if (!res.ok) throw new Error('Failed to fetch detailed stats');
      return res.json() as Promise<Stats>;
    }
  });

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Message Activity</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats?.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
              />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="messageCount" 
                stroke="#8884d8" 
                name="Messages"
              />
              <Line 
                type="monotone" 
                dataKey="activeUsers" 
                stroke="#82ca9d" 
                name="Active Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Top Commands</h3>
          <div className="space-y-2">
            {stats?.topCommands.map((cmd, idx) => (
              <div key={cmd.command} className="flex justify-between items-center">
                <span>{cmd.command}</span>
                <span className="text-muted-foreground">{cmd.count} uses</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Activity by Hour</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.userActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#8884d8" 
                  name="Messages"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
