import { describe, expect, it } from "bun:test"
import { Effect, Queue } from "effect"
import { LoopState } from "../state"

const run = <A>(effect: Effect.Effect<A, never, LoopState.Service>) =>
  Effect.runPromise(Effect.provide(effect, LoopState.layer))

describe("LoopState edge cases", () => {
  it("disabled_by_failures status persists through snapshot", async () => {
    const state = await run(LoopState.Service)
    await run(state.setStatus("fail-loop", "disabled_by_failures"))
    const entry = await run(state.get("fail-loop"))
    expect(entry.status).toBe("disabled_by_failures")
  })

  it("invalid status persists through snapshot", async () => {
    const state = await run(LoopState.Service)
    await run(state.setStatus("invalid-loop", "invalid"))
    const entry = await run(state.get("invalid-loop"))
    expect(entry.status).toBe("invalid")
  })

  it("consecutive failures accumulate correctly", async () => {
    const state = await run(LoopState.Service)
    await run(state.incrementFailures("count-loop"))
    await run(state.incrementFailures("count-loop"))
    await run(state.incrementFailures("count-loop"))
    const entry = await run(state.get("count-loop"))
    expect(entry.consecutiveFailures).toBe(3)
  })

  it("resetFailures after multiple increments returns to zero", async () => {
    const state = await run(LoopState.Service)
    await run(state.incrementFailures("reset-loop"))
    await run(state.incrementFailures("reset-loop"))
    await run(state.incrementFailures("reset-loop"))
    await run(state.resetFailures("reset-loop"))
    const entry = await run(state.get("reset-loop"))
    expect(entry.consecutiveFailures).toBe(0)
  })

  it("iteration counter increments monotonically", async () => {
    const state = await run(LoopState.Service)
    const i1 = await run(state.nextIteration("mono-loop"))
    const i2 = await run(state.nextIteration("mono-loop"))
    const i3 = await run(state.nextIteration("mono-loop"))
    expect(i1).toBe(1)
    expect(i2).toBe(2)
    expect(i3).toBe(3)
  })

  it("offerQueue returns false when queue is full", async () => {
    const state = await run(LoopState.Service)
    await run(state.ensureQueue("full-loop", 1))
    await run(state.offerQueue("full-loop"))
    const offered = await run(state.offerQueue("full-loop"))
    expect(offered).toBe(false)
  })

  it("takeQueue removes item from queue", async () => {
    const state = await run(LoopState.Service)
    await run(state.ensureQueue("take-loop", 5))
    await run(state.offerQueue("take-loop"))
    await run(state.takeQueue("take-loop"))
    const entry = await run(state.get("take-loop"))
    expect(Queue.sizeUnsafe(entry.queue)).toBe(0)
  })

  it("snapshot returns entry after ensureQueue", async () => {
    const state = await run(LoopState.Service)
    await run(state.ensureQueue("snap-loop", 3))
    const entry = await run(state.snapshot("snap-loop"))
    expect(entry).toBeDefined()
    expect(entry?.status).toBe("idle")
    expect(entry?.queue.capacity).toBe(3)
  })

  it("setActiveSession with undefined clears session", async () => {
    const state = await run(LoopState.Service)
    await run(state.setActiveSession("clear-loop", "sess_abc"))
    const before = await run(state.get("clear-loop"))
    expect(before.activeSessionID).toBe("sess_abc")
    await run(state.setActiveSession("clear-loop"))
    const after = await run(state.get("clear-loop"))
    expect(after.activeSessionID).toBeUndefined()
  })

  it("ensureQueue preserves existing state", async () => {
    const state = await run(LoopState.Service)
    await run(state.setStatus("preserve-loop", "running"))
    await run(state.incrementFailures("preserve-loop"))
    await run(state.ensureQueue("preserve-loop", 10))
    const entry = await run(state.get("preserve-loop"))
    expect(entry.status).toBe("running")
    expect(entry.consecutiveFailures).toBe(1)
    expect(entry.queue.capacity).toBe(10)
  })
})
