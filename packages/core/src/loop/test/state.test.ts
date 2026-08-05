import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { LoopState } from "../state"

const run = <A>(effect: Effect.Effect<A, never, LoopState.Service>) =>
  Effect.runPromise(Effect.provide(effect, LoopState.layer))

describe("LoopState", () => {

  it("snapshot returns undefined for unknown loop", async () => {
    const state = await run(LoopState.Service)
    const entry = await run(state.snapshot("nonexistent"))
    expect(entry).toBeUndefined()
  })

  it("getOrCreate creates entry on first access", async () => {
    const state = await run(LoopState.Service)
    await run(state.ensureQueue("test-loop", 10))
    const entry = await run(state.get("test-loop"))
    expect(entry.status).toBe("idle")
    expect(entry.consecutiveFailures).toBe(0)
    expect(entry.iteration).toBe(0)
  })

  it("setStatus updates status", async () => {
    const state = await run(LoopState.Service)
    await run(state.setStatus("test-loop", "running"))
    const entry = await run(state.get("test-loop"))
    expect(entry.status).toBe("running")
  })

  it("incrementFailures increments counter", async () => {
    const state = await run(LoopState.Service)
    const count = await run(state.incrementFailures("test-loop"))
    expect(count).toBe(1)
    const count2 = await run(state.incrementFailures("test-loop"))
    expect(count2).toBe(2)
  })

  it("resetFailures resets counter", async () => {
    const state = await run(LoopState.Service)
    await run(state.incrementFailures("reset-loop"))
    await run(state.incrementFailures("reset-loop"))
    await run(state.resetFailures("reset-loop"))
    const entry = await run(state.get("reset-loop"))
    expect(entry.consecutiveFailures).toBe(0)
  })

  it("nextIteration increments iteration", async () => {
    const state = await run(LoopState.Service)
    const i1 = await run(state.nextIteration("iter-loop"))
    expect(i1).toBe(1)
    const i2 = await run(state.nextIteration("iter-loop"))
    expect(i2).toBe(2)
  })

  it("setActiveSession sets and clears", async () => {
    const state = await run(LoopState.Service)
    await run(state.setActiveSession("session-loop", "ses_123"))
    const entry = await run(state.get("session-loop"))
    expect(entry.activeSessionID).toBe("ses_123")
    await run(state.setActiveSession("session-loop"))
    const entry2 = await run(state.get("session-loop"))
    expect(entry2.activeSessionID).toBeUndefined()
  })

  it("ensureQueue creates bounded queue", async () => {
    const state = await run(LoopState.Service)
    await run(state.ensureQueue("queue-loop", 5))
    const entry = await run(state.get("queue-loop"))
    expect(entry.queue.capacity).toBe(5)
  })

  it("offerQueue returns true when space available", async () => {
    const state = await run(LoopState.Service)
    await run(state.ensureQueue("offer-loop", 2))
    const offered = await run(state.offerQueue("offer-loop"))
    expect(offered).toBe(true)
  })
})
