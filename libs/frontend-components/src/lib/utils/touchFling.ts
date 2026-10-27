import type { Point } from '@tabletop/common'

const DECAY_PER_FRAME = 0.92
const MIN_VELOCITY = 0.02
const MAX_VELOCITY = 2.5
const FRAME_MS = 1000 / 60
const EPSILON = 0.001
/** iOS sends no touchmove while a finger rests, so a finger lifted after a pause still has its old speed. */
const STILL_BEFORE_LIFT_MS = 100

export type Fling = {
    stop(): void
    readonly running: boolean
}

/** Speed in px/ms, blending a finger's latest move with its speed so far. */
export function fingerVelocity(previous: number, delta: number, elapsedMs: number) {
    const sample = Math.min(Math.max(delta / elapsedMs, -MAX_VELOCITY), MAX_VELOCITY)
    return previous * 0.35 + sample * 0.65
}

type FlingStop = { stopOn: Node | Window; stop: () => void }

const stoppableFlings = new Set<FlingStop>()

function stopFlingsUnder(event: Event) {
    const target = event.target
    for (const { stopOn, stop } of stoppableFlings)
        if (!(stopOn instanceof Node) || (target instanceof Node && stopOn.contains(target))) stop()
}

// Added once, as the page loads: WebKit restyles the whole page whenever a touch or wheel listener
// is added or removed, which froze a phone for 50ms as each fling began and ended.
if (typeof window !== 'undefined') {
    window.addEventListener('touchstart', stopFlingsUnder, { capture: true, passive: true })
    window.addEventListener('wheel', stopFlingsUnder, { capture: true, passive: true })
}

function isFlinging(velocity: Point) {
    return Math.abs(velocity.x) >= MIN_VELOCITY || Math.abs(velocity.y) >= MIN_VELOCITY
}

/**
 * Carries on a lifted finger's movement, slowing each frame. `move` returns how far each axis really
 * moved, and an axis that stops moving stops flinging. A touch or wheel on `stopOn` stops it, as a
 * touch stops a native fling.
 */
export function fling(
    velocity: Point,
    stillMs: number,
    move: (offset: Point) => Point,
    stopOn?: Node | Window
): Fling {
    let current = velocity
    let frame: number | undefined
    let lastTimestamp: number | undefined
    const stoppable: FlingStop | undefined = stopOn ? { stopOn, stop } : undefined
    function stop() {
        if (frame !== undefined) cancelAnimationFrame(frame)
        frame = undefined
        if (stoppable) stoppableFlings.delete(stoppable)
    }
    const step = (timestamp: number) => {
        frame = undefined
        const elapsed =
            lastTimestamp === undefined ? FRAME_MS : Math.max(1, timestamp - lastTimestamp)
        lastTimestamp = timestamp
        const moved = move({ x: current.x * elapsed, y: current.y * elapsed })
        const decay = Math.pow(DECAY_PER_FRAME, elapsed / FRAME_MS)
        current = {
            x: Math.abs(moved.x) > EPSILON ? current.x * decay : 0,
            y: Math.abs(moved.y) > EPSILON ? current.y * decay : 0
        }
        if (!isFlinging(current)) return stop()
        frame = requestAnimationFrame(step)
    }
    if (stillMs <= STILL_BEFORE_LIFT_MS && isFlinging(velocity)) {
        if (stoppable) stoppableFlings.add(stoppable)
        frame = requestAnimationFrame(step)
    }
    return {
        stop,
        get running() {
            return frame !== undefined
        }
    }
}
