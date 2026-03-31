import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    isPlaceCompanyDeeds,
    type HydratedIndonesiaGameState
} from '@tabletop/indonesia'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import type { IndonesiaGameSession } from '$lib/model/session.svelte.js'
import {
    availableDeedCardEntriesForState,
    type DeedCardEntry
} from '$lib/utils/deedCardEntries.js'

type DeedPlacementAnimatorCallbacks = {
    showAnimatedDeedCards: (args: {
        cards: DeedCardEntry[]
        animatedDeedIds: string[]
        targetActionCount: number
    }) => void
}

const INITIAL_SCALE = 0.2
const POP_OVERSHOOT_SCALE = 1.14
const ACTION_POP_DURATION = 0.16
const ACTION_SETTLE_DURATION = 0.12
const ACTION_STAGGER = 0.06
const FALLBACK_POP_DURATION = 0.08
const FALLBACK_SETTLE_DURATION = 0.06
const FALLBACK_STAGGER_TOTAL = 0.04

function hashString(value: string): number {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

export class DeedPlacementAnimator {
    private deedElements = new Map<string, HTMLElement | SVGElement>()
    private registered = false
    private readonly onGameStateChangeHandler: ({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedIndonesiaGameState
        from?: HydratedIndonesiaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) => Promise<void>

    constructor(
        private gameSession: IndonesiaGameSession,
        private callbacks: DeedPlacementAnimatorCallbacks
    ) {
        this.onGameStateChangeHandler = this.onGameStateChange.bind(this)
    }

    setDeedElement(deedId: string, element: HTMLElement | SVGElement): void {
        this.deedElements.set(deedId, element)
    }

    clearDeedElement(deedId: string, element: HTMLElement | SVGElement): void {
        if (this.deedElements.get(deedId) !== element) {
            return
        }
        this.deedElements.delete(deedId)
    }

    register(): void {
        if (this.registered) {
            return
        }
        this.gameSession.addGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = true
    }

    unregister(): void {
        if (!this.registered) {
            return
        }
        this.gameSession.removeGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = false
    }

    private orderedAnimatedEntries(entries: DeedCardEntry[], seed: string): DeedCardEntry[] {
        return [...entries].sort(
            (left, right) =>
                hashString(`${seed}:${left.deedId}`) - hashString(`${seed}:${right.deedId}`)
        )
    }

    async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedIndonesiaGameState
        from?: HydratedIndonesiaGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) {
            return
        }

        const toCards = availableDeedCardEntriesForState(to)
        if (toCards.length === 0) {
            return
        }

        const fromDeedIdSet = new Set(from.availableDeeds.map((deed) => deed.id))
        const addedCards = toCards.filter((card) => !fromDeedIdSet.has(card.deedId))
        const hasPlaceCompanyDeedsAction = !!action && isPlaceCompanyDeeds(action)
        const cardsToAnimate = hasPlaceCompanyDeedsAction ? toCards : addedCards
        if (cardsToAnimate.length === 0) {
            return
        }

        const animationSeed = action?.id ?? `${from.actionCount}->${to.actionCount}`
        const orderedCardsToAnimate = this.orderedAnimatedEntries(cardsToAnimate, animationSeed)
        const deedIdsToAnimate = orderedCardsToAnimate.map((card) => card.deedId)

        this.callbacks.showAnimatedDeedCards({
            cards: toCards,
            animatedDeedIds: deedIdsToAnimate,
            targetActionCount: to.actionCount
        })

        await tick()

        const popDuration = hasPlaceCompanyDeedsAction ? ACTION_POP_DURATION : FALLBACK_POP_DURATION
        const settleDuration = hasPlaceCompanyDeedsAction
            ? ACTION_SETTLE_DURATION
            : FALLBACK_SETTLE_DURATION
        const stagger = hasPlaceCompanyDeedsAction
            ? ACTION_STAGGER
            : deedIdsToAnimate.length <= 1
              ? 0
              : FALLBACK_STAGGER_TOTAL / (deedIdsToAnimate.length - 1)

        for (const [index, card] of orderedCardsToAnimate.entries()) {
            const element = this.deedElements.get(card.deedId)
            if (!element) {
                continue
            }

            const startAt = index * stagger
            gsap.set(element, {
                transformOrigin: 'center center',
                scale: INITIAL_SCALE,
                opacity: 1
            })

            animationContext.actionTimeline.to(
                element,
                {
                    scale: POP_OVERSHOOT_SCALE,
                    duration: popDuration,
                    ease: 'back.out(2.2)'
                },
                startAt
            )

            animationContext.actionTimeline.to(
                element,
                {
                    scale: 1,
                    duration: settleDuration,
                    ease: 'power2.out'
                },
                startAt + popDuration
            )
        }
    }
}

export function attachDeedPlacementAnimator(
    animator: DeedPlacementAnimator
): (element: HTMLElement | SVGElement) => () => void {
    return (element: HTMLElement | SVGElement) => {
        untrack(() => {
            animator.register()
        })

        return () => {
            animator.unregister()
        }
    }
}

export function animatePlacedDeed(
    node: HTMLElement | SVGElement,
    params: { animator: DeedPlacementAnimator; deedId: string }
): {
    update: (next: { animator: DeedPlacementAnimator; deedId: string }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentDeedId = params.deedId
    currentAnimator.setDeedElement(currentDeedId, node)

    return {
        update(next) {
            if (next.animator === currentAnimator && next.deedId === currentDeedId) {
                return
            }

            currentAnimator.clearDeedElement(currentDeedId, node)
            currentAnimator = next.animator
            currentDeedId = next.deedId
            currentAnimator.setDeedElement(currentDeedId, node)
        },
        destroy() {
            currentAnimator.clearDeedElement(currentDeedId, node)
        }
    }
}
