import { type AxialCoordinates } from '@tabletop/common'
import { spaceKey } from '@tabletop/punct'

// Something standing over spaces at a level: a piece, or a mark lying on one.
export type Stander = { key: string; cells: readonly AxialCoordinates[]; level: number }

type Depth = (coords: AxialCoordinates) => number

// How far towards the viewer a space lies; turned, the far side of the table is near.
function depthOf(turned: boolean): Depth {
    const towards = turned ? -1 : 1
    return (coords) => towards * (coords.r + coords.q / 2)
}

// Whether a must be drawn before b, after it, or either way. Over a shared space, the lower
// stands under the higher. Otherwise, of their nearest spaces in neighbouring columns, the
// farther is behind the nearer.
function compare(a: Stander, b: Stander, depth: Depth): number {
    const bKeys = new Set(b.cells.map(spaceKey))
    if (a.cells.some((cell) => bKeys.has(spaceKey(cell)))) {
        return a.level - b.level
    }
    let nearest = Infinity
    let order = 0
    for (const cellA of a.cells) {
        for (const cellB of b.cells) {
            if (Math.abs(cellA.q - cellB.q) > 1) continue
            const apart = Math.abs(depth(cellA) - depth(cellB)) + Math.abs(cellA.q - cellB.q)
            if (apart < nearest) {
                nearest = apart
                order = depth(cellA) - depth(cellB)
            }
        }
    }
    return order
}

// Farthest first, every piece after anything it rests on.
export function drawOrder<T extends Stander>(standers: readonly T[], turned = false): T[] {
    const depth = depthOf(turned)
    const before = new Map<string, Set<string>>(standers.map((s) => [s.key, new Set()]))
    for (let i = 0; i < standers.length; i++) {
        for (let j = i + 1; j < standers.length; j++) {
            const order = compare(standers[i], standers[j], depth)
            if (order < 0) before.get(standers[j].key)?.add(standers[i].key)
            else if (order > 0) before.get(standers[i].key)?.add(standers[j].key)
        }
    }
    const frontOf = (stander: Stander) => Math.max(...stander.cells.map(depth))
    const remaining = standers.toSorted((a, b) => frontOf(a) - frontOf(b) || a.level - b.level)
    const placed = new Set<string>()
    const ordered: T[] = []
    while (remaining.length > 0) {
        const index = remaining.findIndex((stander) =>
            [...(before.get(stander.key) ?? [])].every((key) => placed.has(key))
        )
        // A cycle cannot be drawn right; take the farthest and carry on.
        const [next] = remaining.splice(Math.max(index, 0), 1)
        placed.add(next.key)
        ordered.push(next)
    }
    return ordered
}
