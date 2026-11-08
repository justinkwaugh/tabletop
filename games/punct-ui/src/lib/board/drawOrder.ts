import { type AxialCoordinates } from '@tabletop/common'
import { spaceKey } from '@tabletop/punct'
import { VIEW, type BoardView } from './geometry.js'

// Something standing over spaces at a level: a piece, or a mark lying on one.
export type Stander = { key: string; cells: readonly AxialCoordinates[]; level: number }

// Whether a must be drawn before b, after it, or either way, and whether that is firm. Over a
// shared space, the lower stands under the higher: firm, as drawing them the other way round
// shows a piece through the one resting on it. Otherwise, of their nearest spaces in
// neighbouring columns on screen, the farther is behind the nearer.
function compare(a: Stander, b: Stander, view: BoardView): { order: number; firm: boolean } {
    const bKeys = new Set(b.cells.map(spaceKey))
    if (a.cells.some((cell) => bKeys.has(spaceKey(cell)))) {
        return { order: a.level - b.level, firm: true }
    }
    let nearest = Infinity
    let order = 0
    for (const cellA of a.cells) {
        for (const cellB of b.cells) {
            const across = Math.abs(view.across(cellA) - view.across(cellB))
            if (across > 1) continue
            const apart = Math.abs(view.depth(cellA) - view.depth(cellB)) + across
            if (apart < nearest) {
                nearest = apart
                order = view.depth(cellA) - view.depth(cellB)
            }
        }
    }
    return { order, firm: false }
}

// Farthest first, every piece after anything it rests on.
export function drawOrder<T extends Stander>(standers: readonly T[], view = VIEW): T[] {
    const depth = (coords: AxialCoordinates) => view.depth(coords)
    const before = new Map<string, Set<string>>(standers.map((s) => [s.key, new Set()]))
    const firmlyBefore = new Map<string, Set<string>>(standers.map((s) => [s.key, new Set()]))
    for (let i = 0; i < standers.length; i++) {
        for (let j = i + 1; j < standers.length; j++) {
            const { order, firm } = compare(standers[i], standers[j], view)
            const [first, second] =
                order < 0 ? [standers[i], standers[j]] : [standers[j], standers[i]]
            if (order === 0) continue
            before.get(second.key)?.add(first.key)
            if (firm) firmlyBefore.get(second.key)?.add(first.key)
        }
    }
    const frontOf = (stander: Stander) => Math.max(...stander.cells.map(depth))
    const remaining = standers.toSorted((a, b) => frontOf(a) - frontOf(b) || a.level - b.level)
    const placed = new Set<string>()
    const ready = (stander: Stander, after: Map<string, Set<string>>) =>
        [...(after.get(stander.key) ?? [])].every((key) => placed.has(key))
    const ordered: T[] = []
    while (remaining.length > 0) {
        let index = remaining.findIndex((stander) => ready(stander, before))
        // A cycle of farther and nearer cannot all be drawn right (a piece lying across another's
        // column can be both behind and in front of it): give way on one of those, the farthest
        // piece first, but never draw a piece before one it rests on. Resting runs from lower
        // levels to higher, so some piece is always ready by it.
        if (index < 0) index = remaining.findIndex((stander) => ready(stander, firmlyBefore))
        const [next] = remaining.splice(Math.max(index, 0), 1)
        placed.add(next.key)
        ordered.push(next)
    }
    return ordered
}
