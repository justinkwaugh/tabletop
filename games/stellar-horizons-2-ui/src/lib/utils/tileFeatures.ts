import type { Point } from '@tabletop/common'
import type { SystemFrame } from './boardLayout.js'

export interface Box {
    left: number
    top: number
    right: number
    bottom: number
}

// The printed system name along the top and the printed facts in the lower left of a tile.
export function printedText(frame: Pick<SystemFrame, 'width' | 'height'>): Box[] {
    const { width, height } = frame
    return [
        { left: -width * 0.3, top: -height * 0.5, right: width * 0.3, bottom: -height * 0.37 },
        { left: -width * 0.4, top: height * 0.2, right: width * 0.06, bottom: height * 0.5 }
    ]
}

export function distanceToBox(point: Point, box: Box): number {
    const dx = Math.max(box.left - point.x, 0, point.x - box.right)
    const dy = Math.max(box.top - point.y, 0, point.y - box.bottom)
    return Math.hypot(dx, dy)
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
    return !(
        a.right + gap <= b.left ||
        b.right + gap <= a.left ||
        a.bottom + gap <= b.top ||
        b.bottom + gap <= a.top
    )
}
