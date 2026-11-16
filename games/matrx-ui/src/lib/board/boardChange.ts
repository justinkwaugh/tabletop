import { coordinatesToNumber, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    CENTRE,
    isPair,
    HydratedMatrxBoard,
    PieceKind,
    type Entry,
    type Unit
} from '@tabletop/matrx'

export type BoardDisc = { playerId: string; kind: PieceKind; id?: number }

export function discsOf(stack: readonly Unit[]): BoardDisc[] {
    return stack.flatMap((unit) =>
        Array.from({ length: unit.discIds.length }, (_, index) => ({
            playerId: unit.playerId,
            kind: unit.kind,
            id: unit.discIds[index]
        }))
    )
}

export type PushChange = {
    kind: 'push'
    entry: Entry
    shifted: number
    unit: Unit
    fromCentre: boolean
    forward: boolean
}

export type MoveChange = {
    kind: 'move'
    from: AxialCoordinates
    to: AxialCoordinates
    disc: BoardDisc
    forward: boolean
}

export type DiscChange = { coords: AxialCoordinates; from: number; discs: BoardDisc[] }
export type DiscsChange = { kind: 'discs'; removed: DiscChange[]; added: DiscChange[] }

export type BoardChange = PushChange | MoveChange | DiscsChange

// Undo and history steps carry no action, so the move is read from the boards. A push that moved
// nothing on could have come from either dot beside its spot, so the known move is tried first.
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
                if (top?.kind !== PieceKind.Tamsk || !isPair(top) || isPair(unit)) continue
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
        if (!isPair(unit)) continue
        for (const to of start.potentialTargets(coords)) {
            const board = new HydratedMatrxBoard(start.dehydrate())
            board.movePotential(coords, to)
            if (layout(board) === target) {
                const disc = discsOf([unit])[1]
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
    for (const coords of before.geometry.spots) {
        const was = discsOf(before.stackAt(coords))
        const now = discsOf(after.stackAt(coords))
        let same = 0
        while (
            same < was.length &&
            same < now.length &&
            was[same].playerId === now[same].playerId &&
            was[same].kind === now[same].kind &&
            was[same].id === now[same].id
        ) {
            same += 1
        }
        if (same < was.length) removed.push({ coords, from: same, discs: was.slice(same) })
        if (same < now.length) added.push({ coords, from: same, discs: now.slice(same) })
    }
    return { kind: 'discs', removed, added }
}

function layout(board: HydratedMatrxBoard): string {
    return board.stacks
        .map(
            (stack) =>
                `${coordinatesToNumber(stack.coords)}:${stack.units
                    .map((unit) => `${unit.playerId}/${unit.kind}/${unit.discIds.length}`)
                    .join(',')}`
        )
        .toSorted()
        .join('|')
}
