import { coordinatesToNumber, type AxialCoordinates } from '@tabletop/common'
import type { MarbleColor, Ring } from '@tabletop/zertz'

export type InferredJump = {
    from: AxialCoordinates
    to: AxialCoordinates
    over: AxialCoordinates[]
    color: MarbleColor
}

const HOPS: readonly AxialCoordinates[] = [
    { q: 1, r: 0 },
    { q: -1, r: 0 },
    { q: 0, r: 1 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: -1, r: 1 }
]

// A history step carries no action, so a jump, or a chain of them, is read from the boards.
export function inferJump(
    before: readonly Ring[],
    after: readonly Ring[]
): InferredJump | undefined {
    const marbleAt = (rings: readonly Ring[]) => {
        const marbles = new Map<number, MarbleColor>()
        for (const ring of rings) {
            if (ring.marble !== undefined)
                marbles.set(coordinatesToNumber(ring.coords), ring.marble)
        }
        return (coords: AxialCoordinates) => marbles.get(coordinatesToNumber(coords))
    }
    const beforeAt = marbleAt(before)
    const afterAt = marbleAt(after)
    const flipped = (coords: AxialCoordinates) =>
        (beforeAt(coords) === undefined) !== (afterAt(coords) === undefined)
    const emptyThroughout = (coords: AxialCoordinates) =>
        beforeAt(coords) === undefined && afterAt(coords) === undefined

    const left = before.filter(
        (ring) => ring.marble !== undefined && afterAt(ring.coords) === undefined
    )
    const arrived = after.filter(
        (ring) => ring.marble !== undefined && beforeAt(ring.coords) === undefined
    )

    // Each hop passes over a ring whose marble went or came back, and lands on a ring empty
    // before and after, except the last, which lands where the marble ends.
    const path = (
        at: AxialCoordinates,
        landing: AxialCoordinates,
        over: AxialCoordinates[]
    ): AxialCoordinates[] | undefined => {
        for (const { q, r } of HOPS) {
            const middle = { q: at.q + q, r: at.r + r }
            const next = { q: at.q + 2 * q, r: at.r + 2 * r }
            const key = coordinatesToNumber(middle)
            if (!flipped(middle) || over.some((done) => coordinatesToNumber(done) === key)) {
                continue
            }
            const passed = [...over, middle]
            if (coordinatesToNumber(next) === coordinatesToNumber(landing)) return passed
            if (emptyThroughout(next)) {
                const rest = path(next, landing, passed)
                if (rest !== undefined) return rest
            }
        }
        return undefined
    }

    for (const origin of left) {
        for (const landing of arrived) {
            if (landing.marble !== origin.marble || origin.marble === undefined) continue
            const over = path(origin.coords, landing.coords, [])
            if (over !== undefined) {
                return { from: origin.coords, to: landing.coords, over, color: origin.marble }
            }
        }
    }
    return undefined
}
