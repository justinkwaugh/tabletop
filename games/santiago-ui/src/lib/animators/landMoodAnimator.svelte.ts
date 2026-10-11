import { gsap } from 'gsap'
import { untrack } from 'svelte'
import { landMood, type LandMood } from '$lib/model/landMood.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

type Ambient = {
    element: HTMLElement
    seconds: number
    shown(mood: LandMood): Record<string, number | string>
}

function sameMood(a: LandMood, b: LandMood) {
    return a.lush === b.lush && a.drought === b.drought
}

// Owns the land's light and dust motes. After a played move they ease toward the mood the move
// leaves, over seconds; the tween runs beside the shared timeline rather than on it, since a
// timeline that long would hold up play. Any other change of the shown mood, from undo, a step
// through history or a silent restoration, is applied at once. See the visual
// contract's "The land's mood".
export class LandMoodAnimator extends StateAnimator {
    private readonly ambients = new Set<Ambient>()
    private easingTo: LandMood | undefined

    // Registers an element whose style follows the mood, starting at the mood shown now.
    ambient(seconds: number, shown: Ambient['shown']) {
        return (element: HTMLElement) => {
            const ambient: Ambient = { element, seconds, shown }
            this.ambients.add(ambient)
            gsap.set(element, shown(untrack(() => this.gameSession.landMood)))
            return () => {
                gsap.killTweensOf(element)
                this.ambients.delete(ambient)
            }
        }
    }

    // Brings every ambient element to the shown mood at once, unless a played move's ease is
    // already heading there.
    settle(mood: LandMood) {
        if (this.easingTo && sameMood(this.easingTo, mood)) return
        this.easingTo = undefined
        for (const { element, shown } of this.ambients) {
            gsap.killTweensOf(element)
            gsap.set(element, shown(mood))
        }
    }

    override async onGameStateChange({ to, action }: StateChange) {
        if (!action) return
        const incoming = this.gameSession.incomingGameState
        if (to.actionCount < incoming.actionCount) return
        const target = landMood(incoming)
        if (sameMood(target, this.gameSession.landMood)) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        this.easingTo = target
        for (const { element, seconds, shown } of this.ambients) {
            gsap.killTweensOf(element)
            gsap.to(element, { ...shown(target), duration: seconds, ease: 'power1.inOut' })
        }
    }
}
