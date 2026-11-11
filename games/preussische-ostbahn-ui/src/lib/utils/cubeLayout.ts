import type { Point } from '@tabletop/common'

export type CubeSlot = Point & { size: number }

export function cubeSlots(
    center: Point,
    count: number,
    city: boolean,
    berlin: boolean
): CubeSlot[] {
    if (!city) {
        return count > 0 ? [{ x: center.x, y: center.y, size: 20 }] : []
    }
    const crowded = !berlin && count > 4
    const size = berlin ? (count <= 4 ? 20 : 16) : citySize(count)
    const perRow = 4
    const gap = 2
    const top = berlin ? center.y + 5 : crowded ? center.y - 6 : center.y
    return Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / perRow)
        const inRow = Math.min(perRow, count - row * perRow)
        const column = index % perRow
        const width = inRow * size + (inRow - 1) * gap
        return {
            x: center.x - width / 2 + size / 2 + column * (size + gap),
            y: top + row * (size + gap),
            size
        }
    })
}

function citySize(count: number): number {
    if (count <= 2) return 20
    if (count === 3) return 18
    if (count === 4) return 14
    return 11
}
