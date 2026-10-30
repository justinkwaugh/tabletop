import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { CENTRE, HydratedMatrxBoard, PieceKind, type Entry, type Unit } from '@tabletop/matrx'
import { coordsKey } from './geometry.js'

// One disc of a stack, by owner and kind.
export type BoardDisc = { playerId: string; kind: PieceKind }

export function discsOf(stack: readonly Unit[]): BoardDisc[] {
    return stack.flatMap((unit) =>
        Array<BoardDisc>(unit.paired ? 2 : 1).fill({ playerId: unit.playerId, kind: unit.kind })
    )
}

// A push from a dot: what came in (a TAMSK extra move takes its piece from the centre's pair),
// how many stacks it moved on, and whether the step goes forward through it or back out of it.
export type PushChange = {
    kind: 'push'
    entry: Entry
    shifted: number
    unit: Unit
    fromCentre: boolean
    forward: boolean
}

// A potential's top piece moving from one spot to another.
export type MoveChange = {
    kind: 'move'
    from: AxialCoordinates
    to: AxialCoordinates
    disc: BoardDisc
    forward: boolean
}

// Anything else, spot by spot: the discs that leave the top of a stack and those that arrive.
export type DiscChange = { coords: AxialCoordinates; from: number; discs: BoardDisc[] }
export type DiscsChange = { kind: 'discs'; removed: DiscChange[]; added: DiscChange[] }

export type BoardChange = PushChange | MoveChange | DiscsChange

// What a known move did is read from the boards, so Undo and history steps, which carry no
// action, play the same motion backwards or forwards. A push that moved nothing on could have come
// from either dot beside its spot, so the move the step knows of is tried first.
export function boardChange(
    before: HydratedMatrxBoard,
    after: HydratedMatrxBoard,
    known?: { dot: AxialCoordinates; to: AxialCoordinates }
): BoardChange {
    const entries = before.geometry.entries
    const first = known
        ? entries.filter(
              (entry) =>
                  sameCoordinates(entry.dot, known.dot) && sameCoordinates(entry.line[0], known.to)
          )
        : []
    return (
        pushBetween(before, after, true, first) ??
        pushBetween(after, before, false, first) ??
        pushBetween(before, after, true, entries) ??
        pushBetween(after, before, false, entries) ??
        moveBetween(before, after, true) ??
        moveBetween(after, before, false) ??
        discsBetween(before, after)
    )
}

function pushBetween(
    start: HydratedMatrxBoard,
    end: HydratedMatrxBoard,
    forward: boolean,
    entries: readonly Entry[]
): PushChange | undefined {
    const target = layout(end)
    for (const entry of entries) {
        const arrived = end.stackAt(entry.line[0])
        if (arrived.length !== 1 || !start.canPush(entry)) continue
        const unit = arrived[0]
        for (const fromCentre of [false, true]) {
            const board = new HydratedMatrxBoard(start.dehydrate())
            if (fromCentre) {
                const top = board.topAt(CENTRE)
                if (top?.kind !== PieceKind.Tamsk || !top.paired || unit.paired) continue
                board.takeTopOfPair(CENTRE)
            }
            const shifted = board.shiftedBy(entry)
            board.push(entry, unit)
            if (layout(board) === target) {
                return { kind: 'push', entry, shifted, unit, fromCentre, forward }
            }
        }
    }
    return undefined
}

function moveBetween(
    start: HydratedMatrxBoard,
    end: HydratedMatrxBoard,
    forward: boolean
): MoveChange | undefined {
    const target = layout(end)
    for (const { coords, unit } of start.tops()) {
        if (!unit.paired) continue
        for (const to of start.potentialTargets(coords)) {
            const board = new HydratedMatrxBoard(start.dehydrate())
            board.movePotential(coords, to)
            if (layout(board) === target) {
                const disc = { playerId: unit.playerId, kind: unit.kind }
                return forward
                    ? { kind: 'move', from: coords, to, disc, forward }
                    : { kind: 'move', from: to, to: coords, disc, forward }
            }
        }
    }
    return undefined
}

function discsBetween(before: HydratedMatrxBoard, after: HydratedMatrxBoard): DiscsChange {
    const removed: DiscChange[] = []
    const added: DiscChange[] = []
    for (const { coords } of before.spots) {
        const was = discsOf(before.stackAt(coords))
        const now = discsOf(after.stackAt(coords))
        let same = 0
        while (
            same < was.length &&
            same < now.length &&
            was[same].playerId === now[same].playerId &&
            was[same].kind === now[same].kind
        ) {
            same += 1
        }
        if (same < was.length) removed.push({ coords, from: same, discs: was.slice(same) })
        if (same < now.length) added.push({ coords, from: same, discs: now.slice(same) })
    }
    return { kind: 'discs', removed, added }
}

function layout(board: HydratedMatrxBoard): string {
    return board.spots
        .filter((spot) => spot.stack.length > 0)
        .map(
            (spot) =>
                `${coordsKey(spot.coords)}:${spot.stack
                    .map((unit) => `${unit.playerId}/${unit.kind}/${unit.paired}`)
                    .join(',')}`
        )
        .toSorted()
        .join('|')
}
