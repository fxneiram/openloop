export * as LoopState from "./state"

import { Context, Effect, Layer, Queue, SynchronizedRef } from "effect"

export type Status = "idle" | "running" | "disabled_by_failures" | "invalid"

export type Entry = {
  status: Status
  consecutiveFailures: number
  iteration: number
  queue: Queue.Queue<void>
  activeSessionID?: string
}

export interface Interface {
  readonly get: (loopName: string) => Effect.Effect<Entry>
  readonly snapshot: (loopName: string) => Effect.Effect<Entry | undefined>
  readonly setStatus: (loopName: string, status: Status) => Effect.Effect<void>
  readonly incrementFailures: (loopName: string) => Effect.Effect<number>
  readonly resetFailures: (loopName: string) => Effect.Effect<void>
  readonly nextIteration: (loopName: string) => Effect.Effect<number>
  readonly setActiveSession: (loopName: string, sessionID?: string) => Effect.Effect<void>
  readonly offerQueue: (loopName: string) => Effect.Effect<boolean>
  readonly takeQueue: (loopName: string) => Effect.Effect<void>
  readonly ensureQueue: (loopName: string, capacity: number) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/LoopState") {}

export const make = Effect.gen(function* () {
  const state = yield* SynchronizedRef.make(new Map<string, Entry>())

  const makeEntry = (capacity: number): Effect.Effect<Entry> =>
    Effect.gen(function* () {
      const queue = yield* Queue.bounded<void>(capacity)
      return {
        status: "idle",
        consecutiveFailures: 0,
        iteration: 0,
        queue,
      }
    })

  const get = Effect.fn("LoopState.get")(function* (loopName: string) {
    const map = yield* SynchronizedRef.get(state)
    const entry = map.get(loopName)
    if (entry) return entry
    return yield* Effect.die(`Loop state missing for ${loopName}`)
  })

  const snapshot = Effect.fn("LoopState.snapshot")(function* (loopName: string) {
    return (yield* SynchronizedRef.get(state)).get(loopName)
  })

  const modify = Effect.fnUntraced(function* <A>(
    loopName: string,
    fn: (entry: Entry) => readonly [A, Entry],
  ) {
    return yield* SynchronizedRef.modifyEffect(state, (map) =>
      Effect.gen(function* () {
        const entry = map.get(loopName)
        const base = entry ?? (yield* makeEntry(10))
        const [result, updated] = fn(base)
        return [result, new Map(map).set(loopName, updated)] as const
      }),
    )
  })

  const setStatus = Effect.fn("LoopState.setStatus")(function* (loopName: string, status: Status) {
    return yield* modify(loopName, (entry) => [undefined, { ...entry, status }] as const).pipe(Effect.asVoid)
  })

  const incrementFailures = Effect.fn("LoopState.incrementFailures")(function* (loopName: string) {
    return yield* modify(loopName, (entry) => {
      const consecutiveFailures = entry.consecutiveFailures + 1
      return [consecutiveFailures, { ...entry, consecutiveFailures }]
    })
  })

  const resetFailures = Effect.fn("LoopState.resetFailures")(function* (loopName: string) {
    return yield* modify(loopName, (entry) => [undefined, { ...entry, consecutiveFailures: 0 }] as const).pipe(
      Effect.asVoid,
    )
  })

  const nextIteration = Effect.fn("LoopState.nextIteration")(function* (loopName: string) {
    return yield* modify(loopName, (entry) => {
      const iteration = entry.iteration + 1
      return [iteration, { ...entry, iteration }]
    })
  })

  const setActiveSession = Effect.fn("LoopState.setActiveSession")(function* (
    loopName: string,
    sessionID?: string,
  ) {
    return yield* modify(loopName, (entry) => [undefined, { ...entry, activeSessionID: sessionID }] as const).pipe(
      Effect.asVoid,
    )
  })

  const ensureQueue = Effect.fn("LoopState.ensureQueue")(function* (loopName: string, capacity: number) {
    const entry = yield* snapshot(loopName)
    if (entry && entry.queue.capacity === capacity) return
    const queue = yield* Queue.bounded<void>(capacity)
    yield* SynchronizedRef.update(state, (map) => {
      const existing = map.get(loopName)
      return new Map(map).set(loopName, {
        status: existing?.status ?? "idle",
        consecutiveFailures: existing?.consecutiveFailures ?? 0,
        iteration: existing?.iteration ?? 0,
        queue,
        activeSessionID: existing?.activeSessionID,
      })
    })
  })

  const offerQueue = Effect.fn("LoopState.offerQueue")(function* (loopName: string) {
    const entry = yield* get(loopName)
    const size = Queue.sizeUnsafe(entry.queue)
    if (size >= entry.queue.capacity) return false
    return yield* Queue.offer(entry.queue, undefined).pipe(
      Effect.matchEffect({
        onSuccess: () => Effect.succeed(true),
        onFailure: () => Effect.succeed(false),
      }),
    )
  })

  const takeQueue = Effect.fn("LoopState.takeQueue")(function* (loopName: string) {
    const entry = yield* get(loopName)
    yield* Queue.take(entry.queue)
  })

  return Service.of({
    get,
    snapshot,
    setStatus,
    incrementFailures,
    resetFailures,
    nextIteration,
    setActiveSession,
    ensureQueue,
    offerQueue,
    takeQueue,
  })
})

export const layer = Layer.effect(Service, make)
export const node = { kind: "layer", service: Service, layer } as never
