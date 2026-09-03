import { gsap } from 'gsap'
import { isTakePoliticsCard, type PoliticsCard } from '@tabletop/lowenherz'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * TakePoliticsCard's own moment: every other card in the opened pile collapses toward the
 * center while the chosen one gets a spotlight - flies to center, enlarges, holds, then fades.
 * Existing-element tween (Pattern A), not Pattern B: the pile is still open and every card still
 * rendered off `from` for the whole timeline (the session assigns `to`, where the pile has
 * closed, only afterward), so there's nothing transient to stand in for - just real refs.
 */
const RETURN_DURATION = 0.3
const FOCUS_MOVE_DURATION = 0.35
const FOCUS_HOLD_DURATION = 0.5
const FOCUS_FADE_DURATION = 0.3
const FOCUS_SCALE = 1.17

export class PoliticsPileTakeAnimator extends StateAnimator {
    private nodes = new Map<string, HTMLElement>()
    private rowsEl: HTMLElement | undefined

    setNode(cardId: string, element?: HTMLElement) {
        if (element) this.nodes.set(cardId, element)
        else this.nodes.delete(cardId)
    }

    setRowsEl(element?: HTMLElement) {
        this.rowsEl = element
    }

    private center(): { x: number; y: number } | undefined {
        const rect = this.rowsEl?.getBoundingClientRect()
        if (!rect) return undefined
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }

    override async onGameStateChange({ from, to, action, animationContext }: StateChange) {
        if (!from) return
        const timeline = animationContext.actionTimeline

        if (action && isTakePoliticsCard(action)) {
            const cards = action.pile === 'A' ? from.politicsCardPileA : from.politicsCardPileB
            if (cards.length === 0) return
            this.playCinematic(cards, action.cardId, timeline)
            return
        }

        if (action) return

        // Fallback: plain history navigation stepping past a TakePoliticsCard, detected by the
        // pile having just closed. Direct interpolation, no spotlight or per-card identity -
        // every card in the pile just fades out together, standing in for it closing.
        const pile = from.openedPoliticsPile && !to.openedPoliticsPile ? from.openedPoliticsPile : undefined
        if (!pile) return
        const cards = pile === 'A' ? from.politicsCardPileA : from.politicsCardPileB
        if (cards.length === 0) return
        this.playFallback(cards, timeline)
    }

    private playCinematic(cards: PoliticsCard[], chosenId: string, timeline: gsap.core.Timeline) {
        const center = this.center()

        for (const card of cards) {
            if (card.id === chosenId) continue
            const el = this.nodes.get(card.id)
            if (!el || !center) continue
            const rect = el.getBoundingClientRect()
            const dx = center.x - (rect.left + rect.width / 2)
            const dy = center.y - (rect.top + rect.height / 2)
            timeline.to(el, { x: dx, y: dy, scale: 0, opacity: 0, duration: RETURN_DURATION, ease: 'power1.in' }, 0)
        }

        const chosenEl = this.nodes.get(chosenId)
        if (!chosenEl) return
        const rect = chosenEl.getBoundingClientRect()
        const target = center ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        const dx = target.x - (rect.left + rect.width / 2)
        const dy = target.y - (rect.top + rect.height / 2)

        // If the player chose the card while a CardMagnifier had it enlarged, start the real card
        // at that size and let the flight shrink it, and take the magnifier's copy down at the
        // same instant - one card in motion rather than a copy shrinking beside it.
        const magnified = this.gameSession.magnifiedPoliticsCard
        const startScale = magnified?.cardId === chosenId ? magnified.scale : 1
        if (magnified?.cardId === chosenId) this.gameSession.magnifiedPoliticsCard = undefined

        // Above the other (departing) cards for the whole sequence, since it travels over (and
        // the others end up sliding under) it on the way to the center.
        gsap.set(chosenEl, { zIndex: 10, scale: startScale })
        timeline.to(chosenEl, { x: dx, y: dy, scale: FOCUS_SCALE, duration: FOCUS_MOVE_DURATION, ease: 'power2.out' }, 0)
        // The hold is just empty timeline space - nothing to tween, so nothing is added for it.
        timeline.to(
            chosenEl,
            { scale: 0, opacity: 0, duration: FOCUS_FADE_DURATION, ease: 'power1.in' },
            FOCUS_MOVE_DURATION + FOCUS_HOLD_DURATION
        )
    }

    private playFallback(cards: PoliticsCard[], timeline: gsap.core.Timeline) {
        for (const card of cards) {
            const el = this.nodes.get(card.id)
            if (!el) continue
            timeline.to(el, { scale: 0.7, opacity: 0, duration: FALLBACK_DURATION, ease: 'power1.in' }, 0)
        }
    }
}
