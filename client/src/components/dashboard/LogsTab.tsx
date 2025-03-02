import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useState } from "react";
import { addDays } from "date-fns";

const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'critical']);
type LogLevel = z.infer<typeof LogLevelSchema>;

interface Log {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
}

interface LogFilters {
  level: LogLevel | 'all';
  search: string;
  dateRange: {
    from?: Date;
    to?: Date;
  };
}

export function LogsTab() {
  const [filters, setFilters] = useState<LogFilters>({
    level: 'all',
    search: '',
    dateRange: {
      from: addDays(new Date(), -7),
      to: new Date()
    }
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ['/api/bot/logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.level !== 'all') params.append('level', filters.level);
      if (filters.search) params.append('search', filters.search);
      if (filters.dateRange.from) params.append('from', filters.dateRange.from.toISOString());
      if (filters.dateRange.to) params.append('to', filters.dateRange.to.toISOString());

      const res = await fetch(`/api/bot/logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json() as Promise<Log[]>;
    },
    refetchInterval: 5000
  });

  const logLevelColor = {
    debug: 'text-gray-600',
    info: 'text-blue-600',
    warn: 'text-yellow-600',
    error: 'text-red-600',
    critical: 'text-red-700 font-bold'
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <h2 className="text-xl font-bold">System Logs</h2>

          <div className="flex flex-wrap gap-4 items-center">
            <Select 
              value={filters.level}
              onValueChange={(value: LogLevel | 'all') => 
                setFilters(prev => ({ ...prev, level: value }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="debug">Debug & Above</SelectItem>
                <SelectItem value="info">Info & Above</SelectItem>
                <SelectItem value="warn">Warnings & Above</SelectItem>
                <SelectItem value="error">Errors & Above</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
              </SelectContent>
            </Select>

            <DateRangePicker
              value={filters.dateRange}
              onChange={dateRange => 
                setFilters(prev => ({ ...prev, dateRange }))
              }
            />

            <div className="flex gap-2">
              <Input
                placeholder="Search logs..."
                value={filters.search}
                onChange={e => 
                  setFilters(prev => ({ ...prev, search: e.target.value }))
                }
                className="w-[200px]"
              />
              <Button 
                variant="outline"
                onClick={() => 
                  setFilters(prev => ({ ...prev, search: '' }))
                }
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[600px] w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <div className="space-y-2">
              {logs?.map(log => (
                <div key={log.id} className="border rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-medium ${logLevelColor[log.level]}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p>{log.message}</p>
                  {log.metadata && (
                    <pre className="mt-2 p-2 bg-muted rounded text-sm overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                  {log.stackTrace && (
                    <pre className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm overflow-x-auto">
                      {log.stackTrace}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  );
}