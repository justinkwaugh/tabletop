import { gsap } from 'gsap'
import { untrack } from 'svelte'
import { landMood, type LandMood } from '$lib/model/landMood.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

const MOOD_EASE_SECONDS = 0.8

type Ambient = {
    element: HTMLElement
    shown(mood: LandMood): Record<string, number | string>
}

function sameMood(a: LandMood, b: LandMood) {
    return a.lush === b.lush && a.drought === b.drought
}

// Owns the land's light and dust motes. After a played move they ease toward the mood the move
// leaves, on the final timeline once the move's own motion is done. Any other change of the
// shown mood, from undo, a step through history or a silent restoration, is applied at once when
// the state publishes. See the visual contract's "The land's mood".
export class LandMoodAnimator extends StateAnimator {
    private readonly ambients = new Set<Ambient>()

    // Registers an element whose style follows the mood, starting at the mood shown now.
    ambient(shown: Ambient['shown']) {
        return (element: HTMLElement) => {
            const ambient: Ambient = { element, shown }
            this.ambients.add(ambient)
            gsap.set(element, shown(untrack(() => this.gameSession.landMood)))
            return () => {
                gsap.killTweensOf(element)
                this.ambients.delete(ambient)
            }
        }
    }

    // Brings every ambient element to the shown mood at once.
    settle(mood: LandMood) {
        for (const { element, shown } of this.ambients) {
            gsap.killTweensOf(element)
            gsap.set(element, shown(mood))
        }
    }

    override async onGameStateChange({ to, action, animationContext }: StateChange) {
        if (!action) return
        const incoming = this.gameSession.incomingGameState
        if (to.actionCount < incoming.actionCount) return
        const target = landMood(incoming)
        if (sameMood(target, this.gameSession.landMood)) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        for (const { element, shown } of this.ambients) {
            animationContext.finalTimeline.to(
                element,
                { ...shown(target), duration: MOOD_EASE_SECONDS, ease: 'power1.inOut' },
                0
            )
        }
    }
}
