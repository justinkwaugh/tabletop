import type { AxialCoordinates } from '@tabletop/common'
import { POINTS, type HydratedLyngkBoard, type PieceColor } from '@tabletop/lyngk'

export type InferredMove = {
    from: AxialCoordinates
    to: AxialCoordinates
    moved: PieceColor[]
    landedOn: PieceColor[]
    forward: boolean
    scored: boolean
}

const same = (a: readonly PieceColor[], b: readonly PieceColor[]) =>
    a.length === b.length && a.every((color, index) => color === b[index])

// Undo and history steps carry no action, so the move is read from the two boards: one point
// empties onto another (forward), or a stack's top comes off back onto an empty point (backward).
// A scored stack empties both points; `scoredStack`, the stack scored or unscored between the two
// states, tells which point it moved from.
export function inferMove(
    before: HydratedLyngkBoard,
    after: HydratedLyngkBoard,
    scoredStack?: readonly PieceColor[]
): InferredMove | undefined {
    const changed = POINTS.filter((coords) => !same(before.stackAt(coords), after.stackAt(coords)))
    if (changed.length !== 2) return undefined
    for (const [x, y] of [
        [changed[0], changed[1]],
        [changed[1], changed[0]]
    ]) {
        const [xBefore, xAfter] = [before.stackAt(x), after.stackAt(x)]
        const [yBefore, yAfter] = [before.stackAt(y), after.stackAt(y)]
        const move = { from: x, to: y }
        if (xAfter.length === 0 && same(yAfter, [...yBefore, ...xBefore])) {
            return { ...move, moved: xBefore, landedOn: yBefore, forward: true, scored: false }
        }
        if (xBefore.length === 0 && same(yBefore, [...yAfter, ...xAfter])) {
            return { ...move, moved: xAfter, landedOn: yAfter, forward: false, scored: false }
        }
        if (scoredStack === undefined) continue
        const emptied = xAfter.length === 0 && yAfter.length === 0
        if (emptied && same(scoredStack, [...yBefore, ...xBefore])) {
            return { ...move, moved: xBefore, landedOn: yBefore, forward: true, scored: true }
        }
        const restored = xBefore.length === 0 && yBefore.length === 0
        if (restored && same(scoredStack, [...yAfter, ...xAfter])) {
            return { ...move, moved: xAfter, landedOn: yAfter, forward: false, scored: true }
        }
    }
    return undefined
}
