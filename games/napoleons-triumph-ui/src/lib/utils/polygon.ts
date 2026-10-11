import type { Point } from '@tabletop/common'

export function insidePolygon(point: Point, outline: readonly Point[]): boolean {
    return outline.reduce((inside, corner, index) => {
        const previous = outline[(index + outline.length - 1) % outline.length]
        const crosses =
            corner.y > point.y !== previous.y > point.y &&
            point.x <
                ((previous.x - corner.x) * (point.y - corner.y)) / (previous.y - corner.y) +
                    corner.x
        return crosses ? !inside : inside
    }, false)
}
