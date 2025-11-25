import type { Point } from '@tabletop/common'
import { gsap } from 'gsap'

export function fadeOut({
    object,
    duration = 0.3,
    ease,
    position,
    timeline,
    onComplete
}: {
    object?: SVGElement | HTMLElement
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    performAnimation({
        object,
        params: {
            opacity: 0,
            ease,
            duration,
            onComplete
        },
        position,
        timeline
    })
}

export function fadeIn({
    object,
    duration = 0.3,
    ease,
    position,
    timeline,
    onComplete
}: {
    object?: SVGElement | HTMLElement
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    performAnimation({
        object,
        params: {
            opacity: 1,
            ease,
            duration,
            onComplete
        },
        position,
        timeline
    })
}

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
    object?: SVGElement | HTMLElement
    duration?: number
    degrees: number | string
    svgOrigin?: string
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    performAnimation({
        object,
        params: {
            rotation: degrees,
            svgOrigin,
            ease,
            duration,
            onComplete
        },
        position,
        timeline
    })
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
    object?: SVGElement | HTMLElement
    location: Point
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    performAnimation({
        object,
        params: {
            x: location.x,
            y: location.y,
            ease,
            duration,
            onComplete
        },
        position,
        timeline
    })
}

function performAnimation({
    object,
    params,
    position,
    timeline
}: {
    object?: SVGElement | HTMLElement
    params?: any
    position?: gsap.Position
    timeline?: gsap.core.Timeline
}) {
    if (!object) {
        return
    }

    const myTimeline = timeline || gsap.timeline()
    myTimeline.to(object, params, position ?? (timeline ? undefined : 0))

    if (!timeline) {
        myTimeline.play()
    }
}
