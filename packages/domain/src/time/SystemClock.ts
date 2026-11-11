import type { Clock } from "./Clock";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
