import type { Point, RectangleDimensions } from '@tabletop/common'

export type TileChoiceArcInput = {
    center: Point
    count: number
    radius: number
    choiceSize: number
    bounds: RectangleDimensions
}

const DIRECTIONS = [-Math.PI / 2, Math.PI / 2, Math.PI, 0]

export function tileChoiceArc({
    center,
    count,
    radius,
    choiceSize,
    bounds
}: TileChoiceArcInput): Point[] {
    if (count === 0) {
        return []
    }
    const margin = choiceSize / 2 + 6
    const step = 2 * Math.asin(Math.min(1, (choiceSize * 1.12) / (2 * radius)))
    const arcs = DIRECTIONS.map((direction) => {
        const start = direction - ((count - 1) * step) / 2
        return Array.from({ length: count }, (_, index) => ({
            x: center.x + radius * Math.cos(start + index * step),
            y: center.y + radius * Math.sin(start + index * step)
        }))
    })
    const fits = (point: Point) =>
        point.x >= margin &&
        point.x <= bounds.width - margin &&
        point.y >= margin &&
        point.y <= bounds.height - margin
    return arcs.find((points) => points.every(fits)) ?? arcs[0]
}
