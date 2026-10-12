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

export function viewTransformInSvg(rotation: number): string | undefined {
    if (rotation === 0) {
        return undefined
    }
    return rotation > 0
        ? `translate(${BOARD_HEIGHT} 0) rotate(90)`
        : `translate(0 ${BOARD_WIDTH}) rotate(-90)`
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

export interface ViewFrame {
    width: number
    height: number
    /** How much of the height, from the top, is on screen: the map can reach below the fold when the panel above it is tall. */
    seenHeight: number
}

export interface Focus {
    maxScale: number
    padding: number
}

export interface FocusOn extends Focus {
    rect: BoundingBox
}

/** What to focus on so that the rectangle ends up centred in the part of the view that is on screen, at the largest scale that fits it there. The view centres whatever it focuses on in its whole height, so the rectangle is extended downwards by the part that cannot be seen. */
export function focusWhereSeen(rect: BoundingBox, frame: ViewFrame, focus: Focus): FocusOn {
    const roomAcross = frame.width - focus.padding * 2
    const roomDown = frame.seenHeight - focus.padding * 2
    const hidden = frame.height - frame.seenHeight
    if (hidden <= 0 || roomAcross <= 0 || roomDown <= 0) {
        return { rect, ...focus }
    }
    const scale = Math.min(roomAcross / rect.width, roomDown / rect.height, focus.maxScale)
    return {
        rect: { ...rect, height: rect.height + hidden / scale },
        maxScale: scale,
        padding: focus.padding
    }
}
