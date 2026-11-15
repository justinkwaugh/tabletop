import { gsap } from 'gsap'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale. GSAP writes x, y and scale as matrix(), so moving pieces tween a
// plain pose and write translate() and scale() themselves, as upstream's MarraCash queue does
// (78e631d38).

export type Pose = { x: number; y: number; scale: number }

const poses = new WeakMap<SVGElement, Pose>()

export function poseOf(node: SVGElement): Pose {
    let pose = poses.get(node)
    if (pose === undefined) {
        pose = { x: 0, y: 0, scale: 1 }
        poses.set(node, pose)
    }
    return pose
}

function write(node: SVGElement, { x, y, scale }: Pose) {
    const moved = `translate(${x} ${y})`
    node.setAttribute('transform', scale === 1 ? moved : `${moved} scale(${scale})`)
}

export function setPose(node: SVGElement, pose: Partial<Pose>) {
    write(node, Object.assign(poseOf(node), pose))
}

function writing(node: SVGElement, vars: gsap.TweenVars): gsap.TweenVars {
    const pose = poseOf(node)
    const { onUpdate } = vars
    return {
        ...vars,
        onUpdate: (...args: unknown[]) => {
            write(node, pose)
            onUpdate?.(...args)
        }
    }
}

export function tweenPose(node: SVGElement, vars: gsap.TweenVars & Partial<Pose>): gsap.core.Tween {
    return gsap.to(poseOf(node), writing(node, vars))
}

export function fromToPose(
    node: SVGElement,
    from: Partial<Pose>,
    to: gsap.TweenVars & Partial<Pose>
): gsap.core.Tween {
    const tween = gsap.fromTo(poseOf(node), from, writing(node, to))
    // A fromTo shows its start at once unless told not to.
    write(node, poseOf(node))
    return tween
}

export function killPose(node: SVGElement) {
    gsap.killTweensOf(poseOf(node))
}
