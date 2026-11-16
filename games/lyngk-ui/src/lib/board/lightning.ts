import type { Point } from '@tabletop/common'
import { seededRandom } from './random.js'

const STEP = 11
const AMPLITUDE = 5

// A jagged bolt from one point to another: the ends stay put and each point between is pushed
// sideways by a seeded amount, alternating sides like a lightning strike.
export function boltPath(from: Point, to: Point, seed: number): string {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    const steps = Math.max(3, Math.round(length / STEP))
    const normal = { x: -dy / length, y: dx / length }
    const random = seededRandom(seed)
    const points = Array.from({ length: steps + 1 }, (_, index) => {
        const t = index / steps
        const edge = index === 0 || index === steps
        const side = index % 2 === 0 ? 1 : -1
        const push = edge ? 0 : side * AMPLITUDE * (0.35 + 0.65 * random())
        return { x: from.x + dx * t + normal.x * push, y: from.y + dy * t + normal.y * push }
    })
    return points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ')
}
