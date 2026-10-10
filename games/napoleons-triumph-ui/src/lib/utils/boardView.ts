import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'
import { Side } from '@tabletop/napoleons-triumph'
import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'

export enum BoardView {
    North = 'North',
    French = 'French',
    Allied = 'Allied'
}

export function viewRotation(view: BoardView): number {
    return view === BoardView.North ? 0 : view === BoardView.French ? -90 : 90
}

export function viewFor(side: Side | undefined): BoardView {
    return side === Side.Allied ? BoardView.Allied : BoardView.French
}

export function nextView(view: BoardView): BoardView {
    return view === BoardView.North
        ? BoardView.French
        : view === BoardView.French
          ? BoardView.Allied
          : BoardView.North
}

export function viewSize(rotation: number): RectangleDimensions {
    return rotation === 0
        ? { width: BOARD_WIDTH, height: BOARD_HEIGHT }
        : { width: BOARD_HEIGHT, height: BOARD_WIDTH }
}

export function viewTransform(rotation: number): string {
    if (rotation === 0) {
        return 'none'
    }
    return rotation > 0
        ? `translate(${BOARD_HEIGHT}px, 0) rotate(90deg)`
        : `translate(0, ${BOARD_WIDTH}px) rotate(-90deg)`
}

export function toView(point: Point, rotation: number): Point {
    if (rotation === 0) {
        return point
    }
    return rotation > 0
        ? { x: BOARD_HEIGHT - point.y, y: point.x }
        : { x: point.y, y: BOARD_WIDTH - point.x }
}

export function screenAxes(rotation: number): { right: Point; down: Point } {
    if (rotation === 0) {
        return { right: { x: 1, y: 0 }, down: { x: 0, y: 1 } }
    }
    return rotation > 0
        ? { right: { x: 0, y: -1 }, down: { x: 1, y: 0 } }
        : { right: { x: 0, y: 1 }, down: { x: -1, y: 0 } }
}

export function uprightAngle(angle: number, rotation: number): number {
    const onScreen = ((((angle + rotation) % 360) + 540) % 360) - 180
    return onScreen > 90 || onScreen <= -90 ? angle + 180 : angle
}

export function boundsOf(points: Point[], rotation: number): BoundingBox {
    const turned = points.map((point) => toView(point, rotation))
    const xs = turned.map((point) => point.x)
    const ys = turned.map((point) => point.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
