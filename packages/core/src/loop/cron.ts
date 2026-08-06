export * as LoopCron from "./cron"

import { CronExpressionParser } from "cron-parser"

export function nextRunAt(input: { cron: string; timezone: "local" | "UTC"; now?: Date }): number {
  const tz = input.timezone === "UTC" ? "UTC" : undefined
  const interval = CronExpressionParser.parse(input.cron, {
    tz,
    currentDate: input.now ?? new Date(),
  })
  return interval.next().getTime()
}

export function isValid(input: { cron: string; timezone: "local" | "UTC" }): boolean {
  try {
    CronExpressionParser.parse(input.cron, { tz: input.timezone === "UTC" ? "UTC" : undefined })
    return true
  } catch {
    return false
  }
}
