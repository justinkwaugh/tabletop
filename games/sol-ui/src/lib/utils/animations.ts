import { gsap } from 'gsap'

export function rotate({
    object,
    duration = 0.3,
    degrees,
    svgOrigin,
    ease,
    startAt,
    timeline,
    onComplete
}: {
    object: SVGElement | HTMLElement
    duration?: number
    degrees: number | string
    svgOrigin?: string
    ease?: gsap.EaseString | gsap.EaseFunction
    startAt?: number
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}) {
    const myTimeline = timeline || gsap.timeline({ onComplete })
    myTimeline.to(
        object,
        {
            rotation: degrees,
            svgOrigin,
            ease,
            duration
        },
        startAt ?? (timeline ? undefined : 0)
    )

    if (!timeline) {
        myTimeline.play()
    }
}
