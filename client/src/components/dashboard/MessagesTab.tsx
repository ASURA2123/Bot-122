import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  content: string;
  sender: string;
  threadId: string;
  timestamp: string;
}

export function MessagesTab() {
  const { data: messages } = useQuery({
    queryKey: ['/api/bot/messages'],
    queryFn: async () => {
      const res = await fetch('/api/bot/messages');
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json() as Promise<Message[]>;
    },
    refetchInterval: 5000 // Refetch every 5 seconds
  });

  return (
    <Card className="p-4">
      <h2 className="text-xl font-bold mb-4">Recent Messages</h2>
      <ScrollArea className="h-[500px]">
        <div className="space-y-4">
          {messages?.map(msg => (
            <div key={msg.id} className="border rounded p-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>From: {msg.sender}</span>
                <span>Thread: {msg.threadId}</span>
                <span>{new Date(msg.timestamp).toLocaleString()}</span>
              </div>
              <p className="mt-2">{msg.content}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
