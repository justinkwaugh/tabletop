import { gsap } from 'gsap'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale. GSAP writes x, y and scale as matrix(), so moving pieces tween a
// plain pose and write translate() and scale() themselves, as upstream's MarraCash does.

export type Pose = { x: number; y: number; scale: number }

type PoseVars = gsap.TweenVars & Partial<Pose>

const poses = new WeakMap<SVGElement, Pose>()

export function poseOf(node: SVGElement): Pose {
    let pose = poses.get(node)
    if (pose === undefined) {
        pose = { x: 0, y: 0, scale: 1 }
        poses.set(node, pose)
    }
    return pose
}

function write(node: SVGElement) {
    const { x, y, scale } = poseOf(node)
    const moved = `translate(${x} ${y})`
    node.setAttribute('transform', scale === 1 ? moved : `${moved} scale(${scale})`)
}

export function setPose(node: SVGElement, pose: Partial<Pose>) {
    Object.assign(poseOf(node), pose)
    write(node)
}

function writing(node: SVGElement, vars: PoseVars): PoseVars {
    const { onUpdate } = vars
    return {
        ...vars,
        onUpdate: (...args: unknown[]) => {
            write(node)
            onUpdate?.(...args)
        }
    }
}

export function tweenPose(node: SVGElement, vars: PoseVars): gsap.core.Tween {
    return gsap.to(poseOf(node), writing(node, vars))
}

export function fromToPose(node: SVGElement, from: Partial<Pose>, to: PoseVars): gsap.core.Tween {
    setPose(node, from)
    return gsap.fromTo(poseOf(node), from, writing(node, to))
}

export function killPose(node: SVGElement) {
    gsap.killTweensOf(poseOf(node))
}
