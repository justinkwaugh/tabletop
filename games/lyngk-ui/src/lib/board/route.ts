import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    topOf,
    type HydratedLyngkBoard,
    type HydratedLyngkGameState,
    type MovePath,
    type MoveStack,
    type PieceColor
} from '@tabletop/lyngk'

// The route through LYNGK-points never changes a move's outcome, so a move takes the shortest
// one; undo and history steps, which carry no action, find the same route again.
export function shortestRoute(
    state: HydratedLyngkGameState,
    from: AxialCoordinates,
    to: AxialCoordinates
): MovePath | undefined {
    const playerId = state.turnManager.currentTurn()?.playerId
    if (playerId === undefined) return undefined
    return state.board
        .pathsFrom(from, state.rightsOf(playerId), state.rules.maxHeight)
        .filter((path) => sameCoordinates(path.to, to))
        .toSorted((a, b) => a.via.length - b.via.length)[0]
}

// The LYNGK-points a move read from two boards went through: those of the move the session knows
// it to be, or else the shortest route.
export function routeVia(
    state: HydratedLyngkGameState,
    move: { from: AxialCoordinates; to: AxialCoordinates },
    known?: MoveStack
): AxialCoordinates[] {
    if (
        known !== undefined &&
        sameCoordinates(known.from, move.from) &&
        sameCoordinates(known.to, move.to)
    ) {
        return known.via
    }
    return shortestRoute(state, move.from, move.to)?.via ?? []
}

// Every LYNGK connection from the stack at `from`, as pairs of points: to each stack of its own
// claimed top color it can reach, and on from each of those in turn, whether or not a move ends
// beyond them. The point it leaves counts as empty.
export function lyngkConnections(
    board: HydratedLyngkBoard,
    from: AxialCoordinates,
    owned: readonly PieceColor[]
): [AxialCoordinates, AxialCoordinates][] {
    const top = topOf(board.stackAt(from))
    if (top === undefined || !owned.includes(top)) return []
    const links: [AxialCoordinates, AxialCoordinates][] = []
    const reached = [from]
    const queue = [from]
    for (let position = queue.shift(); position !== undefined; position = queue.shift()) {
        for (const target of board.reachableFrom(position, from)) {
            if (topOf(board.stackAt(target)) !== top) continue
            const known = links.some(
                ([x, y]) =>
                    (sameCoordinates(x, position) && sameCoordinates(y, target)) ||
                    (sameCoordinates(x, target) && sameCoordinates(y, position))
            )
            if (!known) links.push([position, target])
            if (!reached.some((coords) => sameCoordinates(coords, target))) {
                reached.push(target)
                queue.push(target)
            }
        }
    }
    return links
}
