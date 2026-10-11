import type { BoundingBox, Point } from '@tabletop/common'

export function boxHolds(box: BoundingBox, point: Point): boolean {
    return (
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height
    )
}
