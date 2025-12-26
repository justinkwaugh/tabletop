import type { Point } from '@tabletop/common'
import { MotionPathPlugin } from 'gsap/dist/MotionPathPlugin'
import { CustomEase } from 'gsap/dist/CustomEase'
import { CustomWiggle } from 'gsap/dist/CustomWiggle'
import { Flip } from 'gsap/dist/Flip'
import { gsap } from 'gsap'

gsap.registerPlugin(MotionPathPlugin)
gsap.registerPlugin(CustomEase)
gsap.registerPlugin(CustomWiggle)
gsap.registerPlugin(Flip)

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
}): gsap.core.Timeline | undefined {
    return performAnimation({
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

export function scale({
    object,
    to,
    duration = 0.3,
    ease,
    position,
    timeline,
    onComplete
}: {
    object?: SVGElement | HTMLElement
    to: number
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    performAnimation({
        object,
        params: {
            scale: to,
            ease,
            duration,
            onComplete
        },
        position,
        timeline
    })
}

export function path({
    object,
    path,
    curviness,
    duration = 0.3,
    ease,
    position,
    timeline,
    onComplete
}: {
    object?: SVGElement | HTMLElement
    path: string | Point[]
    curviness?: number
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    performAnimation({
        object,
        params: {
            motionPath: {
                path,
                curviness: curviness ?? 1
            },
            ease,
            duration,
            onComplete
        },
        position,
        timeline
    })
}

export function animate({
    object,
    params = {},
    duration = 0.3,
    ease,
    position,
    timeline,
    onComplete
}: {
    object?: SVGElement | HTMLElement
    params?: object
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    Object.assign(params, {
        ease,
        duration,
        onComplete
    })

    performAnimation({
        object,
        params,
        position,
        timeline
    })
}

export function call({
    callback,
    duration,
    position,
    timeline,
    onComplete
}: {
    callback: gsap.Callback
    params?: object
    duration?: number
    ease?: gsap.EaseString | gsap.EaseFunction
    position?: gsap.Position
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    const myTimeline = timeline || gsap.timeline()
    myTimeline.call(callback, [], position)
    if (duration !== undefined) {
        const currentDuration = myTimeline.duration()
        // console.log('Current duration:', currentDuration, 'Adding duration:', duration)
        ensureDuration(myTimeline, currentDuration + duration)
    }

    if (!timeline) {
        myTimeline.play()
    }

    return myTimeline
}

export function ensureDuration(timeline: gsap.core.Timeline, duration: number) {
    timeline.set({}, {}, duration)
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
}): gsap.core.Timeline | undefined {
    if (!object) {
        return
    }

    const myTimeline = timeline || gsap.timeline()
    myTimeline.to(object, params, position ?? (timeline ? undefined : 0))

    if (!timeline) {
        myTimeline.play()
    }

    return myTimeline
}
