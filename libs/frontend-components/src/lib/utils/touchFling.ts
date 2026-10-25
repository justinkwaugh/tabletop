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
    stopOn?: EventTarget
): Fling {
    let current = velocity
    let frame: number | undefined
    let lastTimestamp: number | undefined
    const stop = () => {
        if (frame !== undefined) cancelAnimationFrame(frame)
        frame = undefined
        stopOn?.removeEventListener('touchstart', stop, true)
        stopOn?.removeEventListener('wheel', stop, true)
    }
    const step = (timestamp: number) => {
        frame = undefined
        if (lastTimestamp !== undefined) {
            const elapsed = Math.max(1, timestamp - lastTimestamp)
            const moved = move({ x: current.x * elapsed, y: current.y * elapsed })
            const decay = Math.pow(DECAY_PER_FRAME, elapsed / FRAME_MS)
            current = {
                x: Math.abs(moved.x) > EPSILON ? current.x * decay : 0,
                y: Math.abs(moved.y) > EPSILON ? current.y * decay : 0
            }
            if (!isFlinging(current)) return stop()
        }
        lastTimestamp = timestamp
        frame = requestAnimationFrame(step)
    }
    if (stillMs <= STILL_BEFORE_LIFT_MS && isFlinging(velocity)) {
        stopOn?.addEventListener('touchstart', stop, { capture: true, passive: true })
        stopOn?.addEventListener('wheel', stop, { capture: true, passive: true })
        frame = requestAnimationFrame(step)
    }
    return {
        stop,
        get running() {
            return frame !== undefined
        }
    }
}
