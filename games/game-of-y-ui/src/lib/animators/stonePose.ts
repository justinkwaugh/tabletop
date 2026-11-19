import { TILT } from '$lib/board/geometry.js'
import { rockTransform } from '$lib/board/stoneShape.js'

// A stone's pose: where it is, how large, and how far it is tipped about which line through where
// it rests, seen at which tilt. Each property writes the node's transform as it is set. The tip is written as
// translate() and a matrix() without offset, since Firefox leaves a matrix() offset out of the
// board's CSS zoom.
export type StonePose = {
    x: number
    y: number
    scale: number
    rock: number
    axis: number
    tilt: number
}

class NodeStonePose implements StonePose {
    private at = { x: 0, y: 0, scale: 1, rock: 0, axis: 0, tilt: TILT }

    constructor(private readonly node: SVGElement) {}

    get x() {
        return this.at.x
    }
    set x(x: number) {
        this.at.x = x
        this.write()
    }
    get y() {
        return this.at.y
    }
    set y(y: number) {
        this.at.y = y
        this.write()
    }
    get scale() {
        return this.at.scale
    }
    set scale(scale: number) {
        this.at.scale = scale
        this.write()
    }
    get rock() {
        return this.at.rock
    }
    set rock(rock: number) {
        this.at.rock = rock
        this.write()
    }
    get axis() {
        return this.at.axis
    }
    set axis(axis: number) {
        this.at.axis = axis
        this.write()
    }
    get tilt() {
        return this.at.tilt
    }
    set tilt(tilt: number) {
        this.at.tilt = tilt
        this.write()
    }

    private write() {
        const { x, y, scale, rock, axis, tilt } = this.at
        if (x === 0 && y === 0 && scale === 1 && rock === 0) {
            this.node.removeAttribute('transform')
            return
        }
        const { a, b, c, d, e, f } = rock === 0 ? IDENTITY : rockTransform(rock, axis, tilt)
        const linear = [a, b, c, d].map((value) => (value * scale).toFixed(5)).join(' ')
        this.node.setAttribute(
            'transform',
            `translate(${(x + e).toFixed(3)} ${(y + f).toFixed(3)}) matrix(${linear} 0 0)`
        )
    }
}

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

const poses = new WeakMap<SVGElement, NodeStonePose>()

export function stonePoseOf(node: SVGElement): StonePose {
    let pose = poses.get(node)
    if (pose === undefined) {
        pose = new NodeStonePose(node)
        poses.set(node, pose)
    }
    return pose
}

export function setStonePose(node: SVGElement, pose: Partial<StonePose>) {
    Object.assign(stonePoseOf(node), pose)
}
