import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isPlayAllianceCard } from '@tabletop/lowenherz'
import { allianceWalls, heartPosition } from '$lib/model/allianceGeometry.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * A newly-formed alliance's hearts bouncing in, on the shared timeline - the same pop-in shape
 * ScorePopupAnimator uses for its floating "+N"/"-N" (see that file's own doc comment for why: two
 * tweens past rest and back, rather than one implicit overshoot, is what reads as a bounce instead
 * of a slide).
 *
 * Renders its own transient hearts (Pattern B, same as AllianceBurstAnimator) rather than reaching
 * for the real board's heart elements: those only exist once the session assigns the new state,
 * which happens after the shared timeline has already played and after afterAnimations callbacks
 * have run - so there is nothing to tween yet at either of those points. Positions come from
 * `to`, since the alliance is already formed there.
 */
type Heart = { id: string; left: number; top: number }

const INITIAL_SCALE = 0.2
const OVERSHOOT_SCALE = 1.16
const POP = 0.18
const SETTLE = 0.16

export class AllianceFormAnimator extends StateAnimator {
    hearts: Heart[] = $state([])

    private nodes = new Map<string, HTMLElement>()

    setNode(heartId: string, element?: HTMLElement) {
        if (element) this.nodes.set(heartId, element)
        else this.nodes.delete(heartId)
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from) return

        // Cinematic when the action tells us which alliance formed; otherwise fall back to
        // noticing one appeared between the two states (plain history navigation). Undo runs the
        // other way (an alliance disappears) and gets no bounce here - nothing formed.
        const allianceId =
            action && isPlayAllianceCard(action)
                ? (action as unknown as { metadata?: { allianceId?: string } }).metadata?.allianceId
                : to.alliances.find((alliance) => !from.alliances.some((a) => a.id === alliance.id))?.id
        if (!allianceId) return

        const walls = allianceWalls(to, allianceId)
        if (walls.length === 0) return

        const cinematic = !!action
        const scale = cinematic ? 1 : FALLBACK_DURATION / (POP + SETTLE)

        this.hearts = walls.map((wall) => ({
            id: `${wall.col},${wall.row},${wall.edge}`,
            ...heartPosition(wall)
        }))

        await tick()

        const timeline = animationContext.actionTimeline
        for (const heart of this.hearts) {
            const node = this.nodes.get(heart.id)
            if (!node) continue
            gsap.set(node, { scale: INITIAL_SCALE, opacity: 0, transformOrigin: 'center center' })
            timeline.to(
                node,
                { scale: OVERSHOOT_SCALE, opacity: 1, duration: POP * scale, ease: 'back.out(2.2)' },
                0
            )
            timeline.to(node, { scale: 1, duration: SETTLE * scale, ease: 'power2.out' }, POP * scale)
        }

        animationContext.afterAnimations(() => {
            this.hearts = []
        })
    }

    override onDetach() {
        this.hearts = []
    }
}
