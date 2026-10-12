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

export const ANOMALY_SIZE = { width: 126, height: 110 }
const ANOMALY_FROM_CORNER: Point = { x: -4, y: -3 }
const MARKER_FROM_ANOMALY: Point = { x: 56, y: -44 }
export const MARKER_SCALE_ON_ANOMALY = 0.76

// An anomaly takes the tile's lower right corner, where the exploration marker otherwise
// sits, and the marker, drawn smaller, moves to rest on the anomaly's top right corner. That
// spot is clear of every tile's world slots, printed text and edge.
export function frameWithAnomaly(frame: SystemFrame): SystemFrame {
    const anomaly = {
        x: frame.marker.x + ANOMALY_FROM_CORNER.x,
        y: frame.marker.y + ANOMALY_FROM_CORNER.y
    }
    return {
        ...frame,
        anomaly,
        marker: { x: anomaly.x + MARKER_FROM_ANOMALY.x, y: anomaly.y + MARKER_FROM_ANOMALY.y }
    }
}

export function anomalyBox(anomaly: Point): Box {
    return {
        left: anomaly.x - ANOMALY_SIZE.width / 2,
        top: anomaly.y - ANOMALY_SIZE.height / 2,
        right: anomaly.x + ANOMALY_SIZE.width / 2,
        bottom: anomaly.y + ANOMALY_SIZE.height / 2
    }
}

export function anomalyOutline(): string {
    const { width, height } = ANOMALY_SIZE
    return [
        [-width / 2, 0],
        [-width / 4, -height / 2],
        [width / 4, -height / 2],
        [width / 2, 0],
        [width / 4, height / 2],
        [-width / 4, height / 2]
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(' ')
}
