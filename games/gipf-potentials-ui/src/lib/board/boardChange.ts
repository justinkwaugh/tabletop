import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    CENTRE,
    GEOMETRY,
    HydratedGipfPotentialsBoard,
    isPotentialKind,
    PieceKind,
    type Entry,
    type Unit
} from '@tabletop/gipf-potentials'
import { coordsKey } from './geometry.js'
import type { DiscKind } from './pieceShape.js'

// One disc of a stack, by owner and mark, and its id.
export type BoardDisc = { playerId: string; kind: DiscKind; id?: number }

// A basic piece is one plain disc, a GIPF-piece two, a loaded piece a plain disc under its
// potential's, a used potential its own disc.
export function discsOf(stack: readonly Unit[]): BoardDisc[] {
    return stack.flatMap((unit) => {
        const marks: DiscKind[] = isPotentialKind(unit.kind)
            ? [unit.kind]
            : unit.kind === PieceKind.Gipf
              ? [PieceKind.Basic, PieceKind.Basic]
              : [PieceKind.Basic, ...(unit.load === undefined ? [] : [unit.load])]
        return marks.map((kind, index) => ({
            playerId: unit.playerId,
            kind,
            id: unit.discIds[index]
        }))
    })
}

// A push from a dot: what came in (a TAMSK extra move takes its potential from the centre),
// how many stacks it moved on, and whether the step goes forward through it or back out of it.
export type PushChange = {
    kind: 'push'
    entry: Entry
    shifted: number
    unit: Unit
    fromCentre: boolean
    forward: boolean
}

// A potential leaving its piece for another spot. A PÜNCT-potential covering a GIPF-piece leaves
// the game there, and the pieces that cover it come down instead.
export type MoveChange = {
    kind: 'move'
    from: AxialCoordinates
    to: AxialCoordinates
    disc: BoardDisc
    forward: boolean
    cover?: BoardDisc[]
}

// Anything else, spot by spot: the discs that leave the top of a stack and those that arrive.
export type DiscChange = { coords: AxialCoordinates; from: number; discs: BoardDisc[] }
export type DiscsChange = { kind: 'discs'; removed: DiscChange[]; added: DiscChange[] }

export type BoardChange = PushChange | MoveChange | DiscsChange

// What a known move did is read from the boards, so Undo and history steps, which carry no
// action, play the same motion backwards or forwards. A push that moved nothing on could have come
// from either dot beside its spot, so the move the step knows of is tried first.
export function boardChange(
    before: HydratedGipfPotentialsBoard,
    after: HydratedGipfPotentialsBoard,
    known?: { dot: AxialCoordinates; to: AxialCoordinates }
): BoardChange {
    const entries = GEOMETRY.entries
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
    start: HydratedGipfPotentialsBoard,
    end: HydratedGipfPotentialsBoard,
    forward: boolean,
    entries: readonly Entry[]
): PushChange | undefined {
    const target = layout(end)
    for (const entry of entries) {
        const arrived = end.stackAt(entry.line[0])
        if (arrived.length !== 1 || !start.canPush(entry)) continue
        const unit = arrived[0]
        for (const fromCentre of [false, true]) {
            const board = new HydratedGipfPotentialsBoard(start.dehydrate())
            if (fromCentre) {
                if (board.topAt(CENTRE)?.load !== PieceKind.Tamsk || unit.kind !== PieceKind.Tamsk)
                    continue
                board.unload(CENTRE)
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
    start: HydratedGipfPotentialsBoard,
    end: HydratedGipfPotentialsBoard,
    forward: boolean
): MoveChange | undefined {
    const target = layout(end)
    for (const { coords, unit } of start.tops()) {
        if (unit.load === undefined) continue
        for (const to of start.potentialTargets(coords, 2)) {
            const board = new HydratedGipfPotentialsBoard(start.dehydrate())
            const potential = board.unload(coords)
            const cover = start.topAt(to)?.kind === PieceKind.Gipf ? end.topAt(to) : undefined
            if (cover !== undefined && (!forward || cover.playerId !== unit.playerId)) continue
            board.place(to, cover ?? potential)
            if (layout(board) === target) {
                const disc = discsOf([unit])[1]
                return forward
                    ? {
                          kind: 'move',
                          from: coords,
                          to,
                          disc,
                          forward,
                          ...(cover === undefined ? {} : { cover: discsOf([cover]) })
                      }
                    : { kind: 'move', from: to, to: coords, disc, forward }
            }
        }
    }
    return undefined
}

function discsBetween(
    before: HydratedGipfPotentialsBoard,
    after: HydratedGipfPotentialsBoard
): DiscsChange {
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

function layout(board: HydratedGipfPotentialsBoard): string {
    return board.spots
        .filter((spot) => spot.stack.length > 0)
        .map(
            (spot) =>
                `${coordsKey(spot.coords)}:${spot.stack
                    .map((unit) => `${unit.playerId}/${unit.kind}/${unit.load}`)
                    .join(',')}`
        )
        .toSorted()
        .join('|')
}
