import { coordinatesToNumber, type AxialCoordinates } from '@tabletop/common'
import type { MarbleColor, Ring } from '@tabletop/zertz'

export type InferredJump = {
    from: AxialCoordinates
    to: AxialCoordinates
    over: AxialCoordinates
    color: MarbleColor
}

// A history step carries no action, so a jump is read from the boards: a marble leaves one
// ring, a marble of its colour appears two rings away in a line, and the ring between changes.
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

    const left = before.filter(
        (ring) => ring.marble !== undefined && afterAt(ring.coords) === undefined
    )
    const arrived = after.filter(
        (ring) => ring.marble !== undefined && beforeAt(ring.coords) === undefined
    )

    for (const origin of left) {
        for (const landing of arrived) {
            const dq = landing.coords.q - origin.coords.q
            const dr = landing.coords.r - origin.coords.r
            const isTwoStepLine =
                dq % 2 === 0 &&
                dr % 2 === 0 &&
                Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 2
            if (!isTwoStepLine || landing.marble !== origin.marble || origin.marble === undefined) {
                continue
            }
            const over = { q: origin.coords.q + dq / 2, r: origin.coords.r + dr / 2 }
            if ((beforeAt(over) === undefined) !== (afterAt(over) === undefined)) {
                return { from: origin.coords, to: landing.coords, over, color: origin.marble }
            }
        }
    }
    return undefined
}
