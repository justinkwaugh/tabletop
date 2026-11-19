import { neighborsOf, type Stone } from '@tabletop/game-of-y'
import { FLAT_VIEW, plan, STONE_RADIUS, TILTED_VIEW } from './geometry.js'
import { seededRandom } from './random.js'

type Point = { x: number; y: number }

// Labels as both views place them, so a stone lies in the same place either way.
const LABELS_BY_POINT = Map.groupBy(
    [TILTED_VIEW, FLAT_VIEW].flatMap((view) =>
        view.labels.map((label) => ({ ...label, tilt: view.tilt }))
    ),
    (label) => label.point
)

// The least space left between two stones on neighbouring points.
const GAP = 0.3

// Stones set down by hand sit a little off their points. Each stone's offset, seen from above, is
// its own (seeded by its id, so every viewer sees the same board) and never changes once it is
// down: it reaches at most `reach` units, and toward a neighbouring point only as far as leaves a
// stone there room. Toward an empty point a stone takes at most half the space between the two
// stones, so the stone that comes later always fits; toward an earlier stone it takes what that
// stone left. A stone on a side leans toward its label only into the room the label leaves
// beyond a stone on the point, labels shown or not, so a stone stays put when they are toggled.
export function stoneOffsets(stones: readonly Stone[], reach: number): Map<number, Point> {
    const offsets = new Map<number, Point>()
    const byPoint = new Map<string, Point>()
    for (const stone of stones.toSorted((a, b) => a.id - b.id)) {
        const random = seededRandom(stone.id * 7919 + 17)
        const angle = random() * Math.PI * 2
        const length = reach * Math.sqrt(random())
        const wanted = { x: Math.cos(angle) * length, y: Math.sin(angle) * length }
        const at = plan(stone.point)
        let scale = 1
        for (const neighbor of neighborsOf(stone.point)) {
            const there = plan(neighbor)
            const distance = Math.hypot(there.x - at.x, there.y - at.y)
            const toward = { x: (there.x - at.x) / distance, y: (there.y - at.y) / distance }
            const room = distance - 2 * STONE_RADIUS - GAP
            const other = byPoint.get(neighbor)
            // How far this stone may lean toward the neighbouring point.
            const allowed =
                other === undefined ? room / 2 : room + (other.x * toward.x + other.y * toward.y)
            const leaning = wanted.x * toward.x + wanted.y * toward.y
            if (leaning > allowed) scale = Math.min(scale, Math.max(0, allowed) / leaning)
        }
        for (const { going, spare, tilt } of LABELS_BY_POINT.get(stone.point) ?? []) {
            // The label's way out on screen, as a direction seen from above.
            const leaning = wanted.x * going.x + wanted.y * tilt * going.y
            if (leaning > spare) scale = Math.min(scale, spare / leaning)
        }
        const offset = { x: wanted.x * scale, y: wanted.y * scale }
        offsets.set(stone.id, offset)
        byPoint.set(stone.point, offset)
    }
    return offsets
}
