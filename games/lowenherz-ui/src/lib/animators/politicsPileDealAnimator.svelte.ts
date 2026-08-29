import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isLookAtPoliticsPile, type PoliticsCard } from '@tabletop/lowenherz'
import { buildSlotRows, responsiveCardWidth, type PileSlot } from '$lib/model/politicsCardLayout.js'
import { preloadPoliticsCardFace } from '$lib/model/politicsCardImages.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * The politics pile's cards flying in once LookAtPoliticsPile opens it, plus the leftover deck
 * stand-in sliding in alongside them and fading to a dashed placeholder - both starting from
 * wherever PoliticsDeckChooser's own exit animation left off (gameSession.politicsPileOrigin).
 *
 * Renders its own transient slot layout (Pattern B), same reason as AllianceFormAnimator: the
 * real cards only exist in `to`, which the board doesn't render until the session assigns the
 * new state - after the shared timeline has already played. PoliticsPileReveal renders this
 * transient layout while `dealing` is true, then falls back to its own real, interactive
 * rendering (built from the same buildSlotRows helper) the moment it clears.
 */
const DEAL_DURATION = 380 // ms
const DEAL_STAGGER = 45 // ms between each successive card starting its flight
const DECK_SLIDE_DURATION = 300 // ms

export class PoliticsPileDealAnimator extends StateAnimator {
    dealing = $state(false)
    slotRows: PileSlot<PoliticsCard>[][] = $state([])

    private nodes = new Map<string, HTMLElement>()

    setNode(key: string, element?: HTMLElement) {
        if (element) this.nodes.set(key, element)
        else this.nodes.delete(key)
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        // Only the player actually taking a politics card ever deals one in - to.openedPoliticsPile
        // is shared server state, so without this every other connected client (and, while
        // scrubbing history, every other player looking at their own past state) would otherwise
        // splay the real, opened pile's cards face-up too. See selectedPoliticsPile's own comment
        // in session.svelte.ts, which PoliticsPileReveal's template gates its rendering on - this
        // guards the same leak here, since `dealing` drives that template independently of `pile`.
        if (to.politicsTakingPlayerId !== this.gameSession.myPlayer?.id) return

        const pile =
            action && isLookAtPoliticsPile(action)
                ? action.pile
                : to.openedPoliticsPile && to.openedPoliticsPile !== from?.openedPoliticsPile
                  ? to.openedPoliticsPile
                  : undefined
        if (!pile) return

        const cards = pile === 'A' ? to.politicsCardPileA : to.politicsCardPileB
        if (cards.length === 0) return

        // No handoff point to fly from - a page reload landing mid-reveal, or a replay with no
        // live click behind it. Falling through with `dealing` left false lets PoliticsPileReveal
        // just render the real row directly, cards already in place - the same degenerate case
        // the old mount-triggered dealIn silently accepted.
        const origin = this.gameSession.politicsPileOrigin
        if (!origin) return

        const cinematic = !!action
        const rowWidth = this.gameSession.politicsRowWidth ?? 0
        const cardWidth = responsiveCardWidth(rowWidth)

        this.slotRows = buildSlotRows(cards, rowWidth, cardWidth)
        this.dealing = true

        await tick()

        // Hide/reposition every node the instant it mounts, before the preload wait below -
        // otherwise a freshly-mounted card paints at full opacity, in its own final resting
        // position, for however long decoding takes. Rects are measured here, not again after
        // the wait: gsap.set below moves the node, so a second getBoundingClientRect afterward
        // would read the offset position instead of the natural one.
        const deckNode = this.nodes.get('deck')
        if (deckNode) {
            const rect = deckNode.getBoundingClientRect()
            gsap.set(deckNode, {
                x: origin.x - (rect.left + rect.width / 2),
                y: origin.y - (rect.top + rect.height / 2)
            })
        }

        const cardOffsets = new Map<string, { dx: number; dy: number }>()
        for (const card of cards) {
            const node = this.nodes.get(card.id)
            if (!node) continue
            const rect = node.getBoundingClientRect()
            const dx = origin.x - (rect.left + rect.width / 2)
            const dy = origin.y - (rect.top + rect.height / 2)
            cardOffsets.set(card.id, { dx, dy })
            gsap.set(node, { x: dx, y: dy, scale: 0.3, opacity: 0 })
        }

        if (cinematic) {
            // One shared wait rather than dealIn's old per-card `.then()` - every card's stagger
            // slot is relative to the same start, so a slow decode for an early card can no
            // longer push a later, already-cached card's own delay out of sync with it.
            await Promise.all(cards.map((card) => preloadPoliticsCardFace(card)))
        }

        const timeline = animationContext.actionTimeline
        const scale = cinematic ? 1 : FALLBACK_DURATION / (DEAL_DURATION / 1000)

        if (deckNode) {
            timeline.to(deckNode, { x: 0, y: 0, duration: (DECK_SLIDE_DURATION / 1000) * scale, ease: 'power2.out' }, 0)
            // Fades over the same span the last card takes to land (staggered, in cinematic
            // mode) rather than holding at full opacity until dealing flips off and the real row
            // swaps it for the dashed placeholder underneath it - which read as a hard cut, the
            // deck popping out of existence the instant the splay finished instead of dissolving
            // alongside it.
            const totalDealDuration = ((cinematic ? (cards.length - 1) * DEAL_STAGGER : 0) + DEAL_DURATION) / 1000 * scale
            timeline.to(deckNode, { opacity: 0, scale: 0.8, duration: totalDealDuration, ease: 'power1.in' }, 0)
        }

        cards.forEach((card, index) => {
            const node = this.nodes.get(card.id)
            if (!node || !cardOffsets.has(card.id)) return
            const delay = cinematic ? (index * DEAL_STAGGER) / 1000 : 0
            timeline.to(node, { opacity: 1, duration: 0.2 * scale, ease: 'power1.out' }, delay)
            timeline.to(
                node,
                { x: 0, y: 0, scale: 1, duration: (DEAL_DURATION / 1000) * scale, ease: 'power2.out' },
                delay
            )
        })

        animationContext.afterAnimations(() => {
            this.dealing = false
            this.slotRows = []
        })
    }

    override onDetach() {
        this.dealing = false
        this.slotRows = []
    }
}
