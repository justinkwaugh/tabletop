import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type { BoardStack, MoveStack } from '@tabletop/lyngk'

// Pieces that leave one point together for another, bottom to top. A run that ends in a scored
// stack ends on the point it was scored on; one that comes back from a scored stack starts on
// the point that stack stood on.
export type Run = {
    pieces: number[]
    start: AxialCoordinates
    end: AxialCoordinates
    // The LYNGK-points it passes on the way, when the move is known.
    via: AxialCoordinates[]
    // How many pieces stay on the start point under it, and how many it lands on at the end.
    leftBelow: number
    landingOn: number
}

// What changes on the board between two states, piece by piece.
export type BoardDiff = {
    runs: Run[]
    // Each stack a run completes and scores, whole, on the point it was scored on.
    scored: BoardStack[]
    // Each scored stack's base, put back on the point it was scored on, as a run comes back off it.
    unscored: BoardStack[]
    // Stacks that leave the board, or come onto it, with no run to explain them.
    vanished: BoardStack[]
    appeared: BoardStack[]
}

type Place = { coords: AxialCoordinates; index: number }
// Where a piece is in a state: on a point of the board, or in a stack a player scored.
type Location = { board: Place } | { scored: { stack: readonly number[]; index: number } }

// The parts of a state the pieces are in.
type State = {
    board: { stacks: readonly BoardStack[] }
    players: readonly { scored: readonly (readonly number[])[] }[]
}

// The pieces' moves from one board to the next. `move`, when known, is the move between them,
// played forward or taken back, and gives the runs its LYNGK-points; any other run goes straight.
export function boardDiff(from: State, to: State, move?: MoveStack): BoardDiff {
    const before = locate(from)
    const after = locate(to)
    const runs = new Map<string, Run>()
    const scored = new Map<string, BoardStack>()
    const unscored = new Map<string, BoardStack>()
    const accounted = new Set<number>()

    const addTo = (start: AxialCoordinates, end: AxialCoordinates, piece: number) => {
        const key = `${start.q},${start.r}>${end.q},${end.r}`
        const run = runs.get(key) ?? {
            pieces: [],
            start,
            end,
            via: viaOf(start, end, move),
            leftBelow: 0,
            landingOn: 0
        }
        run.pieces.push(piece)
        runs.set(key, run)
        accounted.add(piece)
    }

    for (const [piece, was] of before) {
        const now = after.get(piece)
        if (now === undefined) throw Error(`Piece ${piece} is lost`)
        if ('board' in was && 'board' in now) {
            if (!sameCoordinates(was.board.coords, now.board.coords)) {
                addTo(was.board.coords, now.board.coords, piece)
            }
        } else if ('board' in was && 'scored' in now) {
            // Scored on the point its stack's bottom piece stood on.
            const base = before.get(now.scored.stack[0])
            if (base === undefined || !('board' in base)) continue
            const at = base.board.coords
            scored.set(`${at.q},${at.r}`, { coords: at, pieces: [...now.scored.stack] })
            accounted.add(piece)
            if (!sameCoordinates(was.board.coords, at)) addTo(was.board.coords, at, piece)
        } else if ('scored' in was && 'board' in now) {
            // Back on the board from a scored stack, whose bottom piece is back on its point.
            const base = after.get(was.scored.stack[0])
            if (base === undefined || !('board' in base)) continue
            const at = base.board.coords
            accounted.add(piece)
            if (sameCoordinates(now.board.coords, at)) {
                const key = `${at.q},${at.r}`
                const back = unscored.get(key) ?? { coords: at, pieces: [] }
                back.pieces.push(piece)
                unscored.set(key, back)
            } else {
                addTo(at, now.board.coords, piece)
            }
        }
    }

    for (const run of runs.values()) {
        run.pieces.sort((a, b) => indexIn(before, a) - indexIn(before, b))
        run.leftBelow = indexIn(before, run.pieces[0])
        run.landingOn = indexIn(after, run.pieces[0])
    }
    for (const back of unscored.values()) {
        back.pieces.sort((a, b) => indexIn(after, a) - indexIn(after, b))
    }

    const unaccounted = (stack: BoardStack) => stack.pieces.every((piece) => !accounted.has(piece))
    return {
        runs: [...runs.values()],
        scored: [...scored.values()],
        unscored: [...unscored.values()],
        vanished: from.board.stacks.filter(
            (stack) => unaccounted(stack) && stack.pieces.every((piece) => offBoard(after, piece))
        ),
        appeared: to.board.stacks.filter(
            (stack) => unaccounted(stack) && stack.pieces.every((piece) => offBoard(before, piece))
        )
    }
}

function locate(state: State): Map<number, Location> {
    const located = new Map<number, Location>()
    for (const stack of state.board.stacks) {
        stack.pieces.forEach((piece, index) =>
            located.set(piece, { board: { coords: stack.coords, index } })
        )
    }
    for (const player of state.players) {
        for (const stack of player.scored) {
            stack.forEach((piece, index) => located.set(piece, { scored: { stack, index } }))
        }
    }
    return located
}

// A piece's height in its stack, on the board or in a scored stack.
function indexIn(located: Map<number, Location>, piece: number): number {
    const place = located.get(piece)
    if (place === undefined) throw Error(`Piece ${piece} is lost`)
    return 'board' in place ? place.board.index : place.scored.index
}

function offBoard(located: Map<number, Location>, piece: number): boolean {
    const place = located.get(piece)
    return place === undefined || !('board' in place)
}

// The move's LYNGK-points, in the order a run between its ends passes them.
function viaOf(
    start: AxialCoordinates,
    end: AxialCoordinates,
    move: MoveStack | undefined
): AxialCoordinates[] {
    if (move === undefined) return []
    if (sameCoordinates(move.from, start) && sameCoordinates(move.to, end)) return [...move.via]
    if (sameCoordinates(move.from, end) && sameCoordinates(move.to, start)) {
        return move.via.toReversed()
    }
    return []
}
