import { type AxialCoordinates } from '@tabletop/common'
import { spaceKey } from '@tabletop/punct'
import { VIEW, type BoardView } from './geometry.js'

// Something standing over spaces at a level: a piece, or a mark lying on one.
export type Stander = { key: string; cells: readonly AxialCoordinates[]; level: number }

// A stander's spaces worked out once for the comparisons: their keys, and where each lies.
type Placed = { keys: Set<number>; depths: number[]; acrosses: number[]; level: number }

function placedOf(stander: Stander, view: BoardView): Placed {
    return {
        keys: new Set(stander.cells.map(spaceKey)),
        depths: stander.cells.map((cell) => view.depth(cell)),
        acrosses: stander.cells.map((cell) => view.across(cell)),
        level: stander.level
    }
}

// Whether a must be drawn before b, after it, or either way, and whether that is firm. Over a
// shared space, the lower stands under the higher: firm, as drawing them the other way round
// shows a piece through the one resting on it. Otherwise, of their nearest spaces in
// neighbouring columns on screen, the farther is behind the nearer.
function compare(a: Placed, b: Placed): { order: number; firm: boolean } {
    for (const key of a.keys) {
        if (b.keys.has(key)) return { order: a.level - b.level, firm: true }
    }
    let nearest = Infinity
    let order = 0
    for (let i = 0; i < a.depths.length; i++) {
        for (let j = 0; j < b.depths.length; j++) {
            const across = Math.abs(a.acrosses[i] - b.acrosses[j])
            if (across > 1) continue
            const apart = Math.abs(a.depths[i] - b.depths[j]) + across
            if (apart < nearest) {
                nearest = apart
                order = a.depths[i] - b.depths[j]
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
    const placed = standers.map((stander) => placedOf(stander, view))
    for (let i = 0; i < standers.length; i++) {
        for (let j = i + 1; j < standers.length; j++) {
            const { order, firm } = compare(placed[i], placed[j])
            const [first, second] =
                order < 0 ? [standers[i], standers[j]] : [standers[j], standers[i]]
            if (order === 0) continue
            before.get(second.key)?.add(first.key)
            if (firm) firmlyBefore.get(second.key)?.add(first.key)
        }
    }
    const frontOf = (stander: Stander) => Math.max(...stander.cells.map(depth))
    const remaining = standers.toSorted((a, b) => frontOf(a) - frontOf(b) || a.level - b.level)
    const drawn = new Set<string>()
    const ready = (stander: Stander, after: Map<string, Set<string>>) =>
        [...(after.get(stander.key) ?? [])].every((key) => drawn.has(key))
    const ordered: T[] = []
    while (remaining.length > 0) {
        let index = remaining.findIndex((stander) => ready(stander, before))
        // A cycle of farther and nearer cannot all be drawn right (a piece lying across another's
        // column can be both behind and in front of it): give way on one of those, the farthest
        // piece first, but never draw a piece before one it rests on. Resting runs from lower
        // levels to higher, so some piece is always ready by it.
        if (index < 0) index = remaining.findIndex((stander) => ready(stander, firmlyBefore))
        const [next] = remaining.splice(Math.max(index, 0), 1)
        drawn.add(next.key)
        ordered.push(next)
    }
    return ordered
}
