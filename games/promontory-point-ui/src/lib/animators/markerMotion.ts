import { gsap } from 'gsap'
import type { Point } from '@tabletop/common'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import type { HydratedPromontoryPointGameState } from '@tabletop/promontory-point'

// Undo and history steps move a marker straight to its new place in this long.
export const DIRECT_SECONDS = 0.2

export type Timeline = gsap.core.Timeline

export type BoardStateChange = Parameters<
    GameStateChangeListener<HydratedPromontoryPointGameState>
>[0]

// The session's side of an animator: the board's animators listen while their layer is mounted.
export type BoardAnimationHost = {
    addGameStateChangeListener(
        listener: GameStateChangeListener<HydratedPromontoryPointGameState>
    ): void
    removeGameStateChangeListener(
        listener: GameStateChangeListener<HydratedPromontoryPointGameState>
    ): void
}

// Every write the board's animators make to an element.
export type MotionElement = Pick<SVGElement, 'setAttribute'>

// Where a marker stands, in map units, and how large it is drawn.
export type MarkerPose = Point & { size: number }

type Marker = { element: MotionElement; rest: MarkerPose; pose: MarkerPose }

export type MarkerRest<K> = { motion: MarkerMotion<K>; key: K; rest: MarkerPose }

// A board marker keeps its place in the shown state on an outer group, and its animator moves an
// inner group by an offset from there, so Svelte and the animator never write one transform. The
// offset is a plain translate() and scale(): Firefox leaves an SVG matrix()'s offset out of the
// board's CSS zoom. A marker's pose carries over from one replayed action to the next while the
// shown state waits, and goes back to its rest when the new state lands.
export class MarkerMotion<K> {
    private markers = new Map<K, Marker>()

    rest(key: K, element: MotionElement, rest: MarkerPose) {
        this.markers.set(key, { element, rest, pose: rest })
        element.setAttribute('transform', 'translate(0 0) scale(1)')
    }

    // A keyed replacement can mount before the old element is destroyed, so only the element
    // still registered is forgotten.
    forget(key: K, element: MotionElement) {
        if (this.markers.get(key)?.element === element) this.markers.delete(key)
    }

    clear() {
        this.markers.clear()
    }

    restOf(key: K): MarkerPose | undefined {
        return this.markers.get(key)?.rest
    }

    poseOf(key: K): MarkerPose | undefined {
        return this.markers.get(key)?.pose
    }

    place(key: K, pose: MarkerPose) {
        const marker = this.markers.get(key)
        if (!marker) return
        marker.pose = pose
        const x = pose.x - marker.rest.x
        const y = pose.y - marker.rest.y
        const scale = pose.size / marker.rest.size
        marker.element.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`)
    }

    // Hops through the poses one segment after another, each eased on its own, so the marker
    // visibly steps space by space. Returns when the last hop lands.
    travel(
        timeline: Timeline,
        key: K,
        poses: readonly MarkerPose[],
        start: number,
        secondsPerHop: number,
        hopEase = 'power1.inOut'
    ): number {
        const hops = poses.length - 1
        if (hops < 1 || !this.markers.has(key)) return start
        const ease = gsap.parseEase(hopEase)
        const clock = { hop: 0 }
        const show = () => this.place(key, poseAlong(poses, clock.hop, ease))
        timeline.to(
            clock,
            { hop: hops, duration: hops * secondsPerHop, ease: 'none', onUpdate: show },
            start
        )
        return start + hops * secondsPerHop
    }

    // Straight from where the marker stands to the pose, in one move.
    glide(
        timeline: Timeline,
        key: K,
        to: MarkerPose,
        start: number,
        duration = DIRECT_SECONDS
    ): number {
        const from = this.poseOf(key)
        if (!from) return start
        return this.travel(timeline, key, [from, to], start, duration, 'power2.out')
    }

    // Reduced motion: the marker is shown at the pose at once, without moving there.
    jump(key: K, to: MarkerPose) {
        this.place(key, to)
    }
}

function poseAlong(
    poses: readonly MarkerPose[],
    hop: number,
    ease: (progress: number) => number
): MarkerPose {
    const last = poses.length - 1
    const index = Math.min(Math.floor(hop), last - 1)
    const from = poses[index]
    const to = poses[index + 1]
    const t = ease(Math.min(1, hop - index))
    return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        size: from.size + (to.size - from.size) * t
    }
}

export function samePose(a: MarkerPose, b: MarkerPose): boolean {
    return a.x === b.x && a.y === b.y && a.size === b.size
}

// The inner group of a board marker: rests it at its shown pose, and again whenever the shown
// state moves it.
export function restMarker<K>(node: SVGGElement, params: MarkerRest<K>) {
    let current = params
    current.motion.rest(current.key, node, current.rest)
    return {
        update(next: MarkerRest<K>) {
            if (next.key !== current.key) {
                current.motion.forget(current.key, node)
                next.motion.rest(next.key, node, next.rest)
            } else if (!samePose(next.rest, current.rest)) {
                next.motion.rest(next.key, node, next.rest)
            }
            current = next
        },
        destroy() {
            current.motion.forget(current.key, node)
        }
    }
}
