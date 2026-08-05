import { describe, expect, it } from "bun:test"
import { LoopCron } from "../cron"

describe("LoopCron", () => {
  it("nextRunAt returns a future timestamp", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const next = LoopCron.nextRunAt({ cron: "0 * * * *", timezone: "UTC", now })
    expect(next).toBeGreaterThan(now.getTime())
  })

  it("nextRunAt with local timezone", () => {
    const now = new Date("2026-01-01T00:00:00")
    const next = LoopCron.nextRunAt({ cron: "0 * * * *", timezone: "local", now })
    expect(next).toBeGreaterThan(now.getTime())
  })

  it("isValid returns true for valid cron", () => {
    expect(LoopCron.isValid({ cron: "0 * * * *", timezone: "UTC" })).toBe(true)
    expect(LoopCron.isValid({ cron: "0 9 * * 1-5", timezone: "local" })).toBe(true)
  })

  it("isValid returns false for invalid cron", () => {
    expect(LoopCron.isValid({ cron: "invalid", timezone: "UTC" })).toBe(false)
    expect(LoopCron.isValid({ cron: "60 * * * *", timezone: "UTC" })).toBe(false)
  })
})
