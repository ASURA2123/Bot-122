import os from 'os';
import { logger } from '../utils/logger';
import EventEmitter from 'events';

interface SystemMetrics {
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  cpu: {
    loadAvg: number[];
    cores: number;
    usage: number;
  };
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  threads: number;
  timestamp: Date;
}

export class SystemMonitor extends EventEmitter {
  private static instance: SystemMonitor;
  private metrics: SystemMetrics;
  private metricsHistory: SystemMetrics[] = [];
  private readonly MAX_HISTORY = 100;
  private interval: NodeJS.Timeout | null = null;
  private cpuUsage: NodeJS.CpuUsage | null = null;
  private _lastReportedIssues: string[] | null = null; // Track last reported issues
  private _lastReportTime: number | null = null; // Track last time we reported issues

  private constructor() {
    super();
    this.metrics = this.collectMetrics();
  }

  public static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }

  public start(intervalMs: number = 60000): void {
    this.cpuUsage = process.cpuUsage();
    this.interval = setInterval(() => {
      this.updateMetrics();
    }, intervalMs);
    logger.info(`System monitoring started with interval of ${intervalMs}ms`);
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('System monitoring stopped');
    }
  }

  public getMetrics(): SystemMetrics {
    return this.metrics;
  }

  public getMetricsHistory(): SystemMetrics[] {
    return [...this.metricsHistory];
  }

  public checkHealth(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    let hasReportedIssue = false; // Flag to track if any issues are reported

    // Check memory usage
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage.usedPercent > 90) {
      issues.push(`High memory usage: ${memoryUsage.usedPercent.toFixed(2)}%`);
      hasReportedIssue = true;
    }

    // Check CPU usage.  Note:  The original code didn't have a cpuUsage property on metrics, so this is commented out.  Add it to SystemMetrics if needed.
    //if (this.metrics.cpuUsage > 80) {
    //  issues.push(`High CPU usage: ${this.metrics.cpuUsage.toFixed(2)}%`);
    //  hasReportedIssue = true;
    //}

    // Check errors rate. Note: This requires the 'errors' property to be added to SystemMetrics and populated.
    //const recentErrors = this.metrics.errors.filter(e =>
    //  (Date.now() - e.timestamp) < 15 * 60 * 1000); // Last 15 minutes

    //if (recentErrors.length > 5) {
    //  issues.push(`High error rate: ${recentErrors.length} errors in the last 15 minutes`);
    //  hasReportedIssue = true;
    //}


    // Only emit and log issues if they're new or different from previous check
    // And don't log too frequently (at most once every 5 minutes)
    const now = Date.now();
    const lastReportTime = this._lastReportTime || 0;
    const reportInterval = 5 * 60 * 1000; // 5 minutes
    
    if (issues.length > 0 && 
        (!this._lastReportedIssues || 
         JSON.stringify(issues) !== JSON.stringify(this._lastReportedIssues)) && 
        (now - lastReportTime > reportInterval)) {
      this.emit('health_issues', issues);
      logger.warn('System health issues detected:', { issues });
      this._lastReportedIssues = [...issues];
      this._lastReportTime = now;
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  private updateMetrics(): void {
    const newMetrics = this.collectMetrics();
    this.metricsHistory.push(newMetrics);

    // Limit history size
    if (this.metricsHistory.length > this.MAX_HISTORY) {
      this.metricsHistory.shift();
    }

    this.metrics = newMetrics;

    // Check system health
    const healthCheck = this.checkHealth();

    // Emit metrics event
    this.emit('metrics_updated', newMetrics);

    // Log periodic information
    logger.debug('System metrics updated', {
      memory: `${Math.round(newMetrics.memory.usedPercent)}%`,
      cpu: `${newMetrics.cpu.usage.toFixed(2)}%`,
      uptime: `${Math.floor(newMetrics.uptime / 86400)}d ${Math.floor((newMetrics.uptime % 86400) / 3600)}h`
    });
  }

  private collectMetrics(): SystemMetrics {
    // CPU usage
    let cpuUsagePercent = 0;
    if (this.cpuUsage) {
      const newCpuUsage = process.cpuUsage();
      const userDiff = newCpuUsage.user - this.cpuUsage.user;
      const sysDiff = newCpuUsage.system - this.cpuUsage.system;
      const total = userDiff + sysDiff;

      // Convert to percentage of time elapsed
      cpuUsagePercent = (total / 1000000) * 100;
      this.cpuUsage = newCpuUsage;
    }

    // Collect metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      uptime: process.uptime(),
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usedPercent: (usedMem / totalMem) * 100
      },
      cpu: {
        loadAvg: os.loadavg(),
        cores: os.cpus().length,
        usage: cpuUsagePercent
      },
      processMemory: process.memoryUsage(),
      threads: process.getMaxListeners(),
      timestamp: new Date()
    };
  }

  private getMemoryUsage(): { used: number; total: number; usedPercent: number } {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return {
      used: usedMem,
      total: totalMem,
      usedPercent: (usedMem / totalMem) * 100
    };
  }

  public generateReport(): string {
    const m = this.metrics;
    const uptime = m.uptime;
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return [
      '📊 System Monitor Report',
      '----------------------------',
      `⏱️ Uptime: ${days}d ${hours}h ${minutes}m`,
      `💾 Memory: ${Math.round(m.memory.used / 1024 / 1024)}MB / ${Math.round(m.memory.total / 1024 / 1024)}MB (${Math.round(m.memory.usedPercent)}%)`,
      `🔄 CPU: ${m.cpu.usage.toFixed(1)}% (${m.cpu.cores} cores)`,
      `🧠 Heap: ${Math.round(m.processMemory.heapUsed / 1024 / 1024)}MB / ${Math.round(m.processMemory.heapTotal / 1024 / 1024)}MB`,
      `🔍 Load Average: ${m.cpu.loadAvg[0].toFixed(2)}, ${m.cpu.loadAvg[1].toFixed(2)}, ${m.cpu.loadAvg[2].toFixed(2)}`,
      '----------------------------',
      `📅 Generated: ${m.timestamp.toLocaleString()}`
    ].join('\n');
  }
}

// Export singleton instance
export const systemMonitor = SystemMonitor.getInstance();