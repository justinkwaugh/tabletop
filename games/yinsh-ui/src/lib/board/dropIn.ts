import { quadOut } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'

// A marker dropping onto its point: it falls from a little above, larger, and lands.
export const DROP = { duration: 0.24, scale: 1.35, rise: -16 }

export function dropIn(_node: Element): TransitionConfig {
    return {
        duration: DROP.duration * 1000,
        easing: quadOut,
        css: (t, u) =>
            `transform: translate(0px, ${u * DROP.rise}px) scale(${1 + u * (DROP.scale - 1)}); opacity: ${Math.min(1, t * 3)}`
    }
}
