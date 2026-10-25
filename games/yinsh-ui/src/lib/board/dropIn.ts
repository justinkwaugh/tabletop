import type { TransitionConfig } from 'svelte/transition'

// A piece falls onto its point from about a row's height, gathering speed, and settles with a
// small bounce; its shadow waits on the board, small and faint, darkening as the piece lands.
// Heights are on screen; `scale` is how much larger the piece starts, nearer the eye.
export const DROP = { fall: 0.26, rise: -45, scale: 1.06, bounce: -4, settle: 0.07, shadow: 0.55 }
// The same drop, smaller: a marker into its ring.
export const MARKER_DROP = {
    fall: 0.2,
    rise: -24,
    scale: 1.04,
    bounce: -2,
    settle: 0.06,
    shadow: 0.6
}

// The staged marker dropping into the chosen ring, as MARKER_DROP; `instant` when it is already
// there.
export function dropIn(_node: Element, { instant = false } = {}): TransitionConfig {
    if (instant) return { duration: 0 }
    const { fall, rise, scale, bounce, settle } = MARKER_DROP
    const total = fall + settle * 2
    return {
        duration: total * 1000,
        css: (t) => {
            const time = t * total
            let y: number
            let s = 1
            if (time < fall) {
                const k = (time / fall) ** 2
                y = rise * (1 - k)
                s = scale + (1 - scale) * k
            } else {
                const k = (time - fall) / (settle * 2)
                y = bounce * Math.sin(Math.PI * k)
            }
            const opacity = Math.min(1, time / (fall * 0.25))
            return `transform: translate(0px, ${y}px) scale(${s}); opacity: ${opacity}`
        }
    }
}

// The staged marker lifting back out of a ring put down: up to where it dropped from, growing a
// little nearer the eye and fading at the top, in Undo's 0.18 s.
export const LIFT_OUT = 0.18

export function liftOut(_node: Element): TransitionConfig {
    const { rise, scale } = MARKER_DROP
    return {
        duration: LIFT_OUT * 1000,
        css: (t) => {
            const k = 1 - (1 - t) ** 2
            const opacity = Math.min(1, (1 - t) / 0.4)
            return `transform: translate(0px, ${rise * k}px) scale(${1 + (scale - 1) * k}); opacity: ${opacity}`
        }
    }
}
