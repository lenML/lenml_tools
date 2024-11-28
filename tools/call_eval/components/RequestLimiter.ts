interface RateLimitConfig {
  rps?: number; // requests per second
  rpm?: number; // requests per minute
  rph?: number; // requests per hour
  rpd?: number; // requests per day
}

export class RequestLimiter {
  private counters: {
    [key: string]: {
      count: number;
      timestamp: number;
    };
  } = {};

  private waitQueue: {
    [key: string]: Array<() => void>;
  } = {};

  constructor(private config: RateLimitConfig) {
    // 初始化计数器
    if (config.rps)
      this.counters["second"] = { count: 0, timestamp: Date.now() };
    if (config.rpm)
      this.counters["minute"] = { count: 0, timestamp: Date.now() };
    if (config.rph) this.counters["hour"] = { count: 0, timestamp: Date.now() };
    if (config.rpd) this.counters["day"] = { count: 0, timestamp: Date.now() };

    // 初始化等待队列
    this.waitQueue = {
      second: [],
      minute: [],
      hour: [],
      day: [],
    };
  }

  private getLimit(type: string): number {
    switch (type) {
      case "second":
        return this.config.rps || Infinity;
      case "minute":
        return this.config.rpm || Infinity;
      case "hour":
        return this.config.rph || Infinity;
      case "day":
        return this.config.rpd || Infinity;
      default:
        return Infinity;
    }
  }

  private getInterval(type: string): number {
    switch (type) {
      case "second":
        return 1000;
      case "minute":
        return 60 * 1000;
      case "hour":
        return 60 * 60 * 1000;
      case "day":
        return 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  private async waitForSlot(type: string): Promise<void> {
    return new Promise((resolve) => {
      const counter = this.counters[type];
      const limit = this.getLimit(type);
      const interval = this.getInterval(type);
      const now = Date.now();

      // 如果已经过了间隔时间，重置计数器
      if (now - counter.timestamp >= interval) {
        counter.count = 0;
        counter.timestamp = now;
      }

      // 如果当前计数小于限制，直接返回
      if (counter.count < limit) {
        resolve();
        return;
      }

      // 否则加入等待队列
      this.waitQueue[type].push(resolve);

      // 设置定时器在间隔结束后释放
      const waiting_ts = interval - (now - counter.timestamp);
      console.log(`[ReqLimit]Waiting for ${waiting_ts}ms...`);
      setTimeout(() => {
        counter.count = 0;
        counter.timestamp = Date.now();
        const waiting = this.waitQueue[type];
        this.waitQueue[type] = [];
        waiting.forEach((resolve) => resolve());
      }, waiting_ts);
    });
  }

  async start(): Promise<void> {
    // 等待所有类型的限制都满足
    await Promise.all(
      Object.keys(this.counters).map((type) => this.waitForSlot(type))
    );

    // 增加所有计数器
    Object.values(this.counters).forEach((counter) => {
      counter.count++;
    });
  }

  async end(): Promise<void> {
    // 减少所有计数器
    Object.values(this.counters).forEach((counter) => {
      counter.count = Math.max(0, counter.count - 1);
    });
  }
}
