import { Mesh, Object3D, Material } from 'three'
import { gsap } from 'gsap'

export function eachMaterial(object: Object3D, fn: (material: Material) => void) {
    object.traverse((object) => {
        if (!(object instanceof Mesh)) {
            return
        }
        if (object.material instanceof Material) {
            fn(object.material)
        } else if (Array.isArray(object.material)) {
            object.material.forEach((material) => {
                fn(material)
            })
        }
    })
}

export function hideInstant(object: Object3D) {
    eachMaterial(object, (material) => {
        material.transparent = true
        material.opacity = 0
        material.needsUpdate = true
    })
}

export function fade({
    object,
    duration = 0.3,
    opacity = 0,
    startAt,
    timeline,
    onComplete
}: {
    object: Object3D | HTMLElement
    duration?: number
    opacity?: number
    startAt?: number
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}): gsap.core.Timeline {
    const myTimeline = timeline || gsap.timeline({ onComplete })

    if (object) {
        if ((object as Object3D).isObject3D) {
            eachMaterial(object as Object3D, (material) => {
                material.transparent = true
                material.needsUpdate = true

                const options = {
                    ease: 'power2.in',
                    duration,
                    opacity
                }
                myTimeline.to(material, options, startAt ?? (timeline ? undefined : 0))
            })
        } else {
            myTimeline.to(
                object as HTMLElement,
                {
                    ease: 'power2.in',
                    duration,
                    opacity
                },
                startAt ?? (timeline ? undefined : 0)
            )
        }

        if (!timeline) {
            myTimeline.play()
        }
    }

    return myTimeline
}

export function fadeOut({
    object,
    timeline,
    duration = 0.3,
    startAt = undefined,
    onComplete
}: {
    object: Object3D | HTMLElement
    timeline?: gsap.core.Timeline
    duration?: number
    startAt?: number
    onComplete?: () => void
}): gsap.core.Timeline {
    return fade({ object, timeline, duration, opacity: 0, startAt, onComplete })
}

export function fadeIn({
    object,
    timeline,
    duration = 0.3,
    startAt = undefined,
    onComplete
}: {
    object: Object3D | HTMLElement
    timeline?: gsap.core.Timeline
    duration?: number
    startAt?: number
    onComplete?: () => void
}): gsap.core.Timeline {
    return fade({ object, timeline, duration, opacity: 1, startAt, onComplete })
}

export function scale({
    object,
    duration = 0.3,
    scale = 1,
    startAt,
    timeline,
    onComplete
}: {
    object: Object3D | HTMLElement
    duration?: number
    scale?: number
    startAt?: number
    timeline?: gsap.core.Timeline
    onComplete?: () => void
}): gsap.core.Timeline {
    const myTimeline = timeline || gsap.timeline({ onComplete })

    if (object) {
        if ((object as Object3D).isObject3D) {
            const options = {
                ease: 'power2.in',
                duration,
                x: scale,
                y: scale,
                z: scale
            }
            myTimeline.to(
                (object as Object3D).scale,
                options,
                startAt ?? (timeline ? undefined : 0)
            )
        }

        if (!timeline) {
            myTimeline.play()
        }
    }

    return myTimeline
}

export function scaleOut({
    object,
    timeline,
    duration = 0.3,
    startAt = undefined,
    onComplete
}: {
    object: Object3D | HTMLElement
    timeline?: gsap.core.Timeline
    duration?: number
    startAt?: number
    onComplete?: () => void
}): gsap.core.Timeline {
    return scale({ object, timeline, duration, scale: 0.1, startAt, onComplete })
}

export function scaleIn({
    object,
    timeline,
    duration = 0.3,
    startAt = undefined,
    onComplete
}: {
    object: Object3D | HTMLElement
    timeline?: gsap.core.Timeline
    duration?: number
    startAt?: number
    onComplete?: () => void
}): gsap.core.Timeline {
    return scale({ object, timeline, duration, scale: 1, startAt, onComplete })
}
