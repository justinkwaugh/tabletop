import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isPlayAllianceCard } from '@tabletop/lowenherz'
import { allianceWalls } from '$lib/model/allianceGeometry.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * A newly-formed alliance's hearts bounce in rather than simply appearing - the same pop-in
 * shape ScorePopupAnimator uses for its floating "+N"/"-N" (see that file's own doc comment for
 * why: two tweens past rest and back, rather than one implicit overshoot, is what reads as a
 * bounce instead of a slide).
 *
 * Unlike AllianceBurstAnimator - which keeps its own local list of hearts, because a burst needs
 * the OLD alliance's hearts still fully intact after the engine has already deleted it - this
 * animator doesn't need a stand-in. It runs from `afterAnimations`, same as ScorePopupAnimator and
 * for the same reason: the session assigns the new state in the same drain as afterAnimations
 * runs, so by the time this fires the REAL heart elements (rendered straight off gameState by
 * RealBoard) already exist with the new alliance in place - there is nothing to fake.
 */
const INITIAL_SCALE = 0.2
const OVERSHOOT_SCALE = 1.16
const POP = 0.18
const SETTLE = 0.16

export class AllianceFormAnimator extends StateAnimator {
    private nodes = new Map<string, HTMLElement>()

    setNode(heartId: string, element?: HTMLElement) {
        if (element) this.nodes.set(heartId, element)
        else this.nodes.delete(heartId)
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from) return

        // Cinematic when the action tells us which alliance formed; otherwise fall back to
        // noticing one appeared between the two states (plain history navigation, at the fast
        // fallback this framework already gives an actionless transition). Undo runs the other
        // way (an alliance disappears) and gets no bounce here - nothing formed.
        const allianceId =
            action && isPlayAllianceCard(action)
                ? (action as unknown as { metadata?: { allianceId?: string } }).metadata?.allianceId
                : to.alliances.find((alliance) => !from.alliances.some((a) => a.id === alliance.id))?.id
        if (!allianceId) return

        const walls = allianceWalls(to, allianceId)
        if (walls.length === 0) return

        const heartIds = walls.map((wall) => `${wall.col},${wall.row},${wall.edge}`)

        animationContext.afterAnimations(async () => {
            await tick()
            for (const heartId of heartIds) {
                const node = this.nodes.get(heartId)
                if (!node) continue
                gsap.set(node, { scale: INITIAL_SCALE, opacity: 0 })
                const timeline = gsap.timeline()
                timeline.to(
                    node,
                    { scale: OVERSHOOT_SCALE, opacity: 1, duration: POP, ease: 'back.out(2.2)' },
                    0
                )
                timeline.to(
                    node,
                    { scale: 1, duration: SETTLE, ease: 'power2.out', clearProps: 'scale' },
                    POP
                )
            }
        })
    }
}
