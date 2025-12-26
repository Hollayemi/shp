// src/lib/performance-logger.ts
class PerformanceLogger {
  private static timers = new Map<string, number>();
  private static logs: Array<{
    operation: string;
    duration: number;
    timestamp: string;
    details?: any;
  }> = [];

  static start(operation: string) {
    const key = `${operation}-${Date.now()}`;
    this.timers.set(key, performance.now());
    console.log(`⏱️ [PerfLog] Started: ${operation}`);
    return key;
  }

  static end(key: string, details?: any) {
    const startTime = this.timers.get(key);
    if (!startTime) {
      console.warn(`⚠️ [PerfLog] No start time found for key: ${key}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    const operation = key.split('-')[0];
    
    const logEntry = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      details,
    };

    this.logs.push(logEntry);
    this.timers.delete(key);

    // Color code based on duration
    const color = duration > 5000 ? '🔴' : duration > 2000 ? '🟡' : '🟢';
    console.log(`${color} [PerfLog] ${operation}: ${Math.round(duration)}ms`, details);

    // Keep only last 50 logs
    if (this.logs.length > 50) {
      this.logs.shift();
    }

    return duration;
  }

  static getLogs() {
    return [...this.logs];
  }

  static getSlowOperations(threshold = 2000) {
    return this.logs.filter(log => log.duration > threshold);
  }

  static async measure<T>(operation: string, fn: () => Promise<T>, details?: any): Promise<T> {
    const key = this.start(operation);
    try {
      const result = await fn();
      this.end(key, { ...details, success: true });
      return result;
    } catch (error) {
      this.end(key, { ...details, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}

export { PerformanceLogger }; 