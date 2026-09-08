import { Mesh, Object3D, Material } from 'three'
import { gsap } from 'gsap'

type AnimationOptions = {
    object: Object3D | HTMLElement
    duration?: number
    startAt?: number
    timeline?: gsap.core.Timeline
    onComplete?: () => void
    onUpdate?: () => void
}

export function eachMaterial(object: Object3D, fn: (material: Material) => void) {
    object.traverse((object) => {
        if (!(object instanceof Mesh)) {
            return
        }
        if (object.material instanceof Material) {
            fn(object.material)
        } else if (Array.isArray(object.material)) {
            object.material.forEach(fn)
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
    onComplete,
    onUpdate
}: AnimationOptions & { opacity?: number }): gsap.core.Timeline {
    const myTimeline = timeline ?? gsap.timeline({ onComplete })
    if (!object) {
        return myTimeline
    }
    const options = { ease: 'power2.in', duration, opacity, onUpdate }
    const position = startAt ?? (timeline ? undefined : 0)

    if (object instanceof Object3D) {
        eachMaterial(object, (material) => {
            material.transparent = true
            material.needsUpdate = true
            myTimeline.to(material, options, position)
        })
    } else {
        myTimeline.to(object, options, position)
    }

    if (!timeline) {
        myTimeline.play()
    }
    return myTimeline
}

export function fadeOut(options: AnimationOptions): gsap.core.Timeline {
    return fade({ ...options, opacity: 0 })
}

export function fadeIn(options: AnimationOptions): gsap.core.Timeline {
    return fade({ ...options, opacity: 1 })
}

export function scale({
    object,
    duration = 0.3,
    scale = 1,
    startAt,
    timeline,
    onComplete,
    onUpdate
}: AnimationOptions & { scale?: number }): gsap.core.Timeline {
    const myTimeline = timeline ?? gsap.timeline({ onComplete })
    if (object instanceof Object3D) {
        myTimeline.to(
            object.scale,
            { ease: 'power2.in', duration, x: scale, y: scale, z: scale, onUpdate },
            startAt ?? (timeline ? undefined : 0)
        )
    }
    if (!timeline) {
        myTimeline.play()
    }
    return myTimeline
}

export function scaleOut(options: AnimationOptions): gsap.core.Timeline {
    return scale({ ...options, scale: 0.1 })
}

export function scaleIn(options: AnimationOptions): gsap.core.Timeline {
    return scale({ ...options, scale: 1 })
}
