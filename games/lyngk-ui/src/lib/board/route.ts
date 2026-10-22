import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import type { HydratedLyngkGameState, MovePath } from '@tabletop/lyngk'

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

// Each link a LYNGK chain can make from one stack: start to first point, then point to point.
export function chainLinks(paths: readonly MovePath[]): [AxialCoordinates, AxialCoordinates][] {
    const links: [AxialCoordinates, AxialCoordinates][] = []
    for (const path of paths) {
        const points = [path.from, ...path.via]
        for (let index = 1; index < points.length; index++) {
            const [a, b] = [points[index - 1], points[index]]
            const known = links.some(
                ([x, y]) =>
                    (sameCoordinates(x, a) && sameCoordinates(y, b)) ||
                    (sameCoordinates(x, b) && sameCoordinates(y, a))
            )
            if (!known) links.push([a, b])
        }
    }
    return links
}
