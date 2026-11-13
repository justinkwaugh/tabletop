import type { TransitionConfig } from 'svelte/transition'

/** R-3.1-H1 How long a pouch takes to turn over at the reveal. */
export const PouchTurnMs = 420

/**
 * R-3.1-H1 A seat's pouch turns over, edge on to face up, when every hand is final. Every pouch
 * shows the one reveal, so each turns from the same moment for the same time and they turn
 * together. With reduced motion the good is simply there.
 */
export function turnOver(_node: Element, { reduced }: { reduced: boolean }): TransitionConfig {
    return {
        duration: reduced ? 0 : PouchTurnMs,
        css: (t) => `transform: perspective(12em) rotateY(${Math.round((1 - t) * 90)}deg)`
    }
}
