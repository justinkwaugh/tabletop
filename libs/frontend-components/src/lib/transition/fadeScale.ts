import type { EasingFunction, TransitionConfig } from 'svelte/transition'

export type FadeScaleParams = {
    delay?: number
    duration?: number
    easing?: EasingFunction
    baseScale?: number
}

export function fadeScale(
    node: Element,
    { delay = 0, duration = 200, easing = (x) => x, baseScale = 0 }: FadeScaleParams
): TransitionConfig {
    const o = +getComputedStyle(node).opacity
    const m = getComputedStyle(node).transform.match(/scale\(([0-9.]+)\)/)
    const s = m ? Number(m[1]) : 1
    const is = 1 - baseScale

    return {
        delay,
        duration,
        css: (t) => {
            const eased = easing(t)
            return `opacity: ${eased * o}; transform: scale(${eased * s * is + baseScale})`
        }
    }
}
