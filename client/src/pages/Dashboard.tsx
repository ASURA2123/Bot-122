import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessagesTab } from "@/components/dashboard/MessagesTab";
import { StatsTab } from "@/components/dashboard/StatsTab"; 
import { StatusTab } from "@/components/dashboard/StatusTab";
import { LogsTab } from "@/components/dashboard/LogsTab";

export default function Dashboard() {
  const { data: botStats } = useQuery({
    queryKey: ['/api/bot/stats'],
    queryFn: async () => {
      const res = await fetch('/api/bot/stats');
      if (!res.ok) throw new Error('Failed to fetch bot stats');
      return res.json();
    }
  });

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Bot Dashboard</h1>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="font-semibold text-sm text-muted-foreground">Active Users</h3>
          <p className="text-2xl font-bold">{botStats?.activeUsers || 0}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold text-sm text-muted-foreground">Messages Today</h3>
          <p className="text-2xl font-bold">{botStats?.messagesToday || 0}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold text-sm text-muted-foreground">Commands Used</h3>
          <p className="text-2xl font-bold">{botStats?.commandsUsed || 0}</p>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="messages" className="w-full">
        <TabsList>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="status">Bot Status</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <MessagesTab />
        </TabsContent>
        
        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>

        <TabsContent value="status">
          <StatusTab />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
