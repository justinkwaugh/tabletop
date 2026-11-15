import { gsap } from 'gsap'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale. GSAP writes x, y and scale as matrix(), so moving pieces tween a
// plain pose and write translate() and scale() themselves, as upstream's MarraCash does
// (78e631d38).

export type Pose = { x: number; y: number; scale: number }

type PoseVars = gsap.TweenVars & Partial<Pose>

// Writes its node's transform as each value is set, so a render that skips callbacks, such as a
// seek, still moves the piece.
class NodePose implements Pose {
    private at = { x: 0, y: 0, scale: 1 }

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

    private write() {
        const { x, y, scale } = this.at
        const moved = `translate(${x} ${y})`
        this.node.setAttribute('transform', scale === 1 ? moved : `${moved} scale(${scale})`)
    }
}

const poses = new WeakMap<SVGElement, NodePose>()

export function poseOf(node: SVGElement): Pose {
    let pose = poses.get(node)
    if (pose === undefined) {
        pose = new NodePose(node)
        poses.set(node, pose)
    }
    return pose
}

export function setPose(node: SVGElement, pose: Partial<Pose>): void {
    Object.assign(poseOf(node), pose)
}

export function tweenPose(node: SVGElement, vars: PoseVars): gsap.core.Tween {
    return gsap.to(poseOf(node), vars)
}

export function fromToPose(node: SVGElement, from: Partial<Pose>, to: PoseVars): gsap.core.Tween {
    return gsap.fromTo(poseOf(node), from, to)
}

export function killPose(node: SVGElement): void {
    gsap.killTweensOf(poseOf(node))
}
