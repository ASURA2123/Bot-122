import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface BotStatus {
  status: 'online' | 'offline' | 'error';
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
  cpu: number;
  lastError?: {
    message: string;
    timestamp: string;
  };
  connectedThreads: number;
}

export function StatusTab() {
  const { data: status } = useQuery({
    queryKey: ['/api/bot/status'],
    queryFn: async () => {
      const res = await fetch('/api/bot/status');
      if (!res.ok) throw new Error('Failed to fetch bot status');
      return res.json() as Promise<BotStatus>;
    },
    refetchInterval: 5000
  });

  const statusColor = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    error: 'bg-yellow-500'
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Bot Status</h3>
          <Badge 
            variant="outline" 
            className={`${status?.status && statusColor[status.status]}`}
          >
            {status?.status?.toUpperCase()}
          </Badge>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Uptime</p>
            <p className="text-lg font-medium">
              {status?.uptime ? formatUptime(status.uptime) : 'N/A'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Memory Usage</p>
            <Progress 
              value={status?.memory ? (status.memory.used / status.memory.total) * 100 : 0}
              className="my-2"
            />
            <p className="text-sm">
              {status?.memory ? `${formatBytes(status.memory.used)} / ${formatBytes(status.memory.total)}` : 'N/A'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">CPU Usage</p>
            <Progress value={status?.cpu} className="my-2" />
            <p className="text-sm">{status?.cpu}%</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Connected Threads</p>
            <p className="text-lg font-medium">{status?.connectedThreads || 0}</p>
          </div>

          {status?.lastError && (
            <div className="mt-4 p-3 bg-red-100 rounded">
              <p className="text-sm text-red-600">Last Error</p>
              <p className="font-medium">{status.lastError.message}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(status.lastError.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
