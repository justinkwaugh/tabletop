import type { CanalSegment, SantiagoBoard } from '@tabletop/santiago'
import { intersectionX, intersectionY } from './boardGeometry.js'

export const CANAL_THICKNESS = 12.48
export const CANAL_HALF_THICKNESS = CANAL_THICKNESS / 2

export type SegmentEnds = { x1: number; y1: number; x2: number; y2: number }

export function segmentEnds(seg: Pick<CanalSegment, 'orientation' | 'col' | 'row'>): SegmentEnds {
    const x = intersectionX(seg.col)
    const y = intersectionY(seg.row)
    return seg.orientation === 'H'
        ? { x1: x, y1: y, x2: intersectionX(seg.col + 1), y2: y }
        : { x1: x, y1: y, x2: x, y2: intersectionY(seg.row + 1) }
}

export function segmentKey(seg: Pick<CanalSegment, 'orientation' | 'col' | 'row'>): string {
    return `${seg.orientation},${seg.col},${seg.row}`
}

export function intersectionKey(col: number, row: number): string {
    return `${col},${row}`
}

export function segmentEndpointKeys(seg: Pick<CanalSegment, 'orientation' | 'col' | 'row'>): [string, string] {
    return seg.orientation === 'H'
        ? [intersectionKey(seg.col, seg.row), intersectionKey(seg.col + 1, seg.row)]
        : [intersectionKey(seg.col, seg.row), intersectionKey(seg.col, seg.row + 1)]
}

// Water reaches a segment from whichever end already touches the spring or a built canal.
export function waterEntersAtFarEnd(seg: CanalSegment, board: Pick<SantiagoBoard, 'spring' | 'canals'>): boolean {
    const watered = new Set([
        intersectionKey(board.spring.col, board.spring.row),
        ...board.canals.flatMap(segmentEndpointKeys)
    ])
    const [nearEnd, farEnd] = segmentEndpointKeys(seg)
    return !watered.has(nearEnd) && watered.has(farEnd)
}
