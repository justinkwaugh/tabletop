import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isDrawActionCard, type ActionCard } from '@tabletop/lowenherz'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * A freshly drawn action card travelling from the draw pile into the middle slot, flipping from its
 * back design to its face on the way.
 *
 * The card being flipped comes from the action's own `to` state, because for the whole length of the
 * flip the board's reactive state is still the previous one (Pattern C, a pre-reactivity override).
 * Its lifetime is exactly one action - dropped in afterAnimations, the last hook before the session
 * assigns the new state. Leaving it set past that was a bug: the derived card goes undefined every
 * time a card is used up, and a stale override matched "state is not showing my card" all over
 * again and re-mounted the flip node un-tweened at rotationY 0, which is the card back.
 */
const FLIP = 0.48

export class ActionCardFlipAnimator extends StateAnimator {
    flippingCard: ActionCard | undefined = $state(undefined)

    private node: HTMLElement | undefined
    private drawPile: HTMLElement | undefined
    private slot: HTMLElement | undefined

    setNode(element?: HTMLElement) {
        this.node = element
    }
    setDrawPile(element?: HTMLElement) {
        this.drawPile = element
    }
    setSlot(element?: HTMLElement) {
        this.slot = element
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        const drawn = to.currentActionCard
        if (!drawn) return

        // Cinematic on a draw; otherwise a fast fallback when the face-up card changed anyway -
        // plain history navigation, or a rewind that lands on a different card. The fallback keeps
        // the card identifiable without the travel or the flip, inside the ~0.1s budget.
        const cinematic = !!action && isDrawActionCard(action)
        if (!cinematic && drawn.id === from?.currentActionCard?.id) return

        this.flippingCard = drawn
        await tick()
        if (!this.node) {
            // Nothing to tween means nothing to show: leaving the override in place would park a
            // static card back over the slot until reactive state caught up.
            this.flippingCard = undefined
            return
        }

        animationContext.afterAnimations(() => {
            this.flippingCard = undefined
        })

        if (!cinematic) {
            gsap.set(this.node, { x: 0, y: 0, rotationY: 180, scale: 0.92, opacity: 0 })
            animationContext.actionTimeline.to(
                this.node,
                { scale: 1, opacity: 1, duration: FALLBACK_DURATION, ease: 'power1.out' },
                0
            )
            return
        }

        // The draw pile and the middle slot are both fixed in place (this grid never reflows), so
        // their offset only needs measuring once, as the flip starts - it makes the card travel from
        // one to the other instead of flipping where it lands.
        let dx = 0
        let dy = 0
        if (this.drawPile && this.slot) {
            const fromRect = this.drawPile.getBoundingClientRect()
            const toRect = this.slot.getBoundingClientRect()
            dx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2)
            dy = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2)
        }

        gsap.set(this.node, {
            x: dx,
            y: dy,
            rotationY: 0,
            scale: 1,
            opacity: 1,
            transformOrigin: 'center center'
        })
        animationContext.actionTimeline.to(
            this.node,
            { x: 0, y: 0, rotationY: 180, duration: FLIP, ease: 'power2.out' },
            0
        )
    }
}
