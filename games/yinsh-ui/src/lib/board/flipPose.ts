import type { Point } from '@tabletop/common'
import type { BoardView } from './geometry.js'

// A marker turning over, seen at the board's tilt. It turns `turn` (0 to π) about the line across
// its path, its trailing edge rising first so it tips forward, the way the ring went. Worked in
// the board's own space (x across, y toward the viewer, z up), then projected.
export type FlipPose = {
    // The side: the outline swept between the two faces' ellipses.
    side: string
    // The face toward the viewer, as an SVG matrix taking a flat circle about the origin onto it.
    face: string
    // Whether the face toward the viewer is the one that was up before the turn.
    upperFace: boolean
}

type Vector = { x: number; y: number; z: number }

const SIDE_POINTS = 24

export function flipPose(
    view: BoardView,
    {
        radius,
        height,
        travel,
        turn,
        hop
    }: {
        radius: number
        height: number
        // The ring's path on the board's plane; only its direction counts.
        travel: Point
        turn: number
        // How far the marker is tossed up, beyond what keeps its low edge off the board.
        hop: number
    }
): FlipPose {
    const length = Math.hypot(travel.x, travel.y) || 1
    const u = { x: travel.x / length, y: travel.y / length }
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    const along: Vector = { x: cos * u.x, y: cos * u.y, z: -sin }
    const across: Vector = { x: -u.y, y: u.x, z: 0 }
    const normal: Vector = { x: sin * u.x, y: sin * u.y, z: cos }
    // High enough that no edge goes into the board, plus the toss.
    const rise = radius * sin + (height / 2) * Math.abs(cos) + hop * sin
    const screen = (v: Vector): Point => ({ x: v.x, y: view.project(v).y - view.height(v.z) })
    const m1 = screen(along)
    const m2 = screen(across)
    const centre = screen({ x: 0, y: 0, z: rise })
    const half = screen({
        x: normal.x * (height / 2),
        y: normal.y * (height / 2),
        z: normal.z * (height / 2)
    })
    const upper = { x: centre.x + half.x, y: centre.y + half.y }
    const lower = { x: centre.x - half.x, y: centre.y - half.y }
    // The viewer looks down the board toward its far side: a face is seen when it points at them.
    const toViewer = normal.y * view.rise + normal.z * view.tilt
    const upperFace = toViewer >= 0

    const t = { x: upper.x - lower.x, y: upper.y - lower.y }
    const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x
    // Where each face's ellipse runs parallel to the sweep between them.
    const tangent = Math.atan2(cross(m2, t), cross(m1, t))
    const onEllipse = (at: Point, angle: number): Point => ({
        x: at.x + radius * (Math.cos(angle) * m1.x + Math.sin(angle) * m2.x),
        y: at.y + radius * (Math.cos(angle) * m1.y + Math.sin(angle) * m2.y)
    })
    const middle = onEllipse({ x: 0, y: 0 }, tangent + Math.PI / 2)
    // The half of the lower face's ellipse away from the upper face, then the upper face's far half.
    const start = middle.x * t.x + middle.y * t.y < 0 ? tangent : tangent + Math.PI
    const arc = (at: Point, from: number) =>
        Array.from({ length: SIDE_POINTS + 1 }, (_, index) =>
            onEllipse(at, from + (Math.PI * index) / SIDE_POINTS)
        )
    const outline = [...arc(lower, start), ...arc(upper, start + Math.PI)]
    const side = `M ${outline.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`

    const at = upperFace ? upper : lower
    const face = `matrix(${[m1.x, m1.y, m2.x, m2.y, at.x, at.y].map((n) => n.toFixed(4)).join(' ')})`
    return { side, face, upperFace }
}
