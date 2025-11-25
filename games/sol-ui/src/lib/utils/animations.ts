import type { Point } from '@tabletop/common'
import { gsap } from 'gsap'

export function rotate({
    object,
    duration = 0.3,
    degrees,
    svgOrigin,
    ease,
    position,
    timeline,
    onComplete
}: {
    object: SVGElement | HTMLElement
    duration?: number
    degrees: number | string
    svgOrigin?: string
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    const myTimeline = timeline || gsap.timeline()
    myTimeline.to(
        object,
        {
            rotation: degrees,
            svgOrigin,
            ease,
            duration,
            onComplete
        },
        position ?? (timeline ? undefined : 0)
    )

    if (!timeline) {
        myTimeline.play()
    }
}

export function move({
    object,
    location,
    duration = 0.3,
    ease,
    position,
    timeline,
    onComplete
}: {
    object: SVGElement | HTMLElement
    location: Point
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    const myTimeline = timeline || gsap.timeline()
    myTimeline.to(
        object,
        {
            x: location.x,
            y: location.y,
            ease,
            duration,
            onComplete
        },
        position ?? (timeline ? undefined : 0)
    )

    if (!timeline) {
        myTimeline.play()
    }
}
