import type { GameAction, Point } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { DeckCard, HydratedPowerGridGameState, Step } from '@tabletop/power-grid'
import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { marketCell } from '$lib/utils/marketLayout.js'

export type MarketCardView = { card: DeckCard; at: Point; leaving: boolean }
export type MarketView = { step: Step; cards: MarketCardView[] }

type MarketCallbacks = {
    // Presence only: lays out the `to` market, with the cards leaving it, before the state swap.
    showMarket: (view: MarketView) => void
    clearMarket: () => void
}

const ACTION = { leave: 0.25, move: 0.35, moveAt: 0.15, enter: 0.35, enterAt: 0.35 }
// Undo and history steps end within 200ms.
const FAST = { leave: 0.15, move: 0.15, moveAt: 0, enter: 0.15, enterAt: 0 }

export function marketView(state: HydratedPowerGridGameState): MarketView {
    return {
        step: state.step,
        cards: state.market.map((card, index) => ({
            card,
            at: marketCell(index, state.step),
            leaving: false
        }))
    }
}

export function marketTransition(
    from: HydratedPowerGridGameState,
    to: HydratedPowerGridGameState
): MarketView | undefined {
    const unchanged =
        from.step === to.step &&
        from.market.length === to.market.length &&
        from.market.every((card, index) => to.market[index] === card)
    if (unchanged) {
        return undefined
    }
    const leaving = from.market
        .map((card, index) => ({ card, at: marketCell(index, from.step), leaving: true }))
        .filter(({ card }) => !to.market.includes(card))
    const view = marketView(to)
    return { ...view, cards: [...view.cards, ...leaving] }
}

export class MarketAnimator {
    private elements = new Map<DeckCard, Element>()

    constructor(private callbacks: MarketCallbacks) {}

    attach(card: DeckCard): Attachment {
        return (node) => {
            this.elements.set(card, node)
            return () => {
                if (this.elements.get(card) === node) {
                    this.elements.delete(card)
                }
            }
        }
    }

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedPowerGridGameState
        to: HydratedPowerGridGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from) {
            return
        }
        const view = marketTransition(from, to)
        if (!view) {
            return
        }
        const before = new Map(
            from.market.map((card, index) => [card, marketCell(index, from.step)])
        )
        this.callbacks.showMarket(view)
        animationContext.afterAnimations(() => this.callbacks.clearMarket())
        await tick()

        const timing = action ? ACTION : FAST
        const timeline = animationContext.actionTimeline
        for (const { card, at, leaving } of view.cards) {
            const node = this.elements.get(card)
            const start = before.get(card)
            if (!node) {
                continue
            }
            if (leaving) {
                timeline.to(node, { opacity: 0, scale: 0.85, duration: timing.leave }, 0)
            } else if (!start) {
                timeline.fromTo(
                    node,
                    { opacity: 0, scale: 0.6 },
                    {
                        opacity: 1,
                        scale: 1,
                        duration: timing.enter,
                        clearProps: 'opacity,transform'
                    },
                    timing.enterAt
                )
            } else if (start.x !== at.x || start.y !== at.y) {
                timeline.fromTo(
                    node,
                    { x: start.x - at.x, y: start.y - at.y },
                    {
                        x: 0,
                        y: 0,
                        duration: timing.move,
                        ease: 'power2.inOut',
                        clearProps: 'transform'
                    },
                    timing.moveAt
                )
            }
        }
    }
}
