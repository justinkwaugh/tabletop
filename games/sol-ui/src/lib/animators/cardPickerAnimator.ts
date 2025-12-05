import {
    Card,
    DrawCards,
    HydratedSolGameState,
    isDrawCards,
    isSolarFlare,
    MachineState,
    SolarFlare,
    Suit,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import type { GameAction } from '@tabletop/common'
import { fadeIn, scale } from '$lib/utils/animations.js'
import { Flip } from 'gsap/dist/Flip'

type CardAndElement = {
    card: Card
    element: HTMLElement | SVGElement
}

export class CardPickerAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private cards: Map<string, CardAndElement> = new Map()
    private tweensPerCard: Map<string, gsap.core.Tween> = new Map()

    constructor(gameSession: SolGameSession) {
        console.log('CardPickerAnimator constructor')
        super(gameSession)
    }

    addCard(card: Card, element: HTMLElement | SVGElement): void {
        console.log('add card to animator:', card.id, card.suit)
        this.cards.set(card.id, { card, element })
        if (
            card.suit === Suit.Flare &&
            this.gameSession.gameState.machineState === MachineState.SolarFlares
        ) {
            this.pulseCard(card, element)
        }
    }

    removeCard(card: Card): void {
        this.stopPulsingCard(card.id)
        this.cards.delete(card.id)

        console.log('remove card from animator:', card.id, card.suit)
    }

    override async onGameStateChange({
        to,
        from,
        actions,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        actions?: GameAction[]
        timeline: gsap.core.Timeline
    }) {
        if (actions && actions.length > 0) {
            await this.animateActions(actions, timeline, to, from)
        }

        if (to.machineState === MachineState.SolarFlares) {
            for (const { card, element } of this.cards.values()) {
                if (card.suit !== Suit.Flare) {
                    continue
                }
                this.pulseCard(card, element)
            }
        } else {
            const pulseIds = Array.from(this.tweensPerCard.keys())
            for (const id of pulseIds) {
                this.stopPulsingCard(id, timeline)
            }
            this.tweensPerCard.clear()
        }
    }

    async animateActions(
        actions: GameAction[],
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        // Each action should probably return it's last position in the timeline
        for (const action of actions) {
            if (isDrawCards(action)) {
                await this.animateDrawCards(action, timeline, toState, fromState)
            } else if (isSolarFlare(action)) {
                await this.animateSolarFlare(action, timeline, toState, fromState)
            }
        }
    }

    async animateDrawCards(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        // Set the drawn cards so that the card picker will render them
        this.gameSession.drawnCards = action.metadata?.drawnCards ?? []

        // Wait for cards to appear in dom and be attached to us
        await tick()

        const delayBetween = 0.2
        const flipDuration = 0.3
        const startTime = 0.3

        // iterate our held cards and animate them in
        let i = 0

        // Get the initial state of the cards laid out in a row
        const state = Flip.getState(
            Array.from(this.cards.values())
                .map((ce) => ce.element)
                .reverse()
        )

        // Hide them all and z-order them oppositely
        let zIndex = 0
        for (const cardAndElement of Array.from(this.cards.values()).reverse()) {
            gsap.set(cardAndElement.element, {
                opacity: 0,
                zIndex
            })
            zIndex++
        }

        // At 0.2 seconds (this sucks, but gives time for the board to resize), fit them to the deck position
        timeline.call(
            () => {
                for (const cardAndElement of Array.from(this.cards.values()).reverse()) {
                    Flip.fit(cardAndElement.element, '#sol-deck', {
                        absolute: true
                    })
                }
            },
            [],
            0.2
        )

        // Now animate them back from the deck.  We don't use flip's stagger because we want to control the order
        let index = 0
        for (const cardAndElement of this.cards.values()) {
            fadeIn({
                object: cardAndElement.element,
                timeline,
                duration: 0.2,
                position: startTime
            })
            timeline.call(
                () => {
                    gsap.set(cardAndElement.element, {
                        zIndex: 10
                    })
                    Flip.to(state, {
                        duration: flipDuration,
                        ease: 'power1.inOut',
                        spin: -1,
                        targets: cardAndElement.element
                    })
                },
                [],
                startTime + delayBetween * index
            )
            index++
        }

        // Remove gsap control
        timeline.call(
            () => {
                for (const cardAndElement of this.cards.values()) {
                    gsap.set(cardAndElement.element, {
                        clearProps: 'all'
                    })
                }
            },
            [],
            startTime + delayBetween * (index - 1) + flipDuration + 0.1
        )
    }

    async animateSolarFlare(
        action: SolarFlare,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        // for (const cardAndElement of this.cards.values()) {
        //     if (cardAndElement.card.suit !== Suit.Flare) {
        //         // Maybe scale out and hide?
        //         continue
        //     }
        //     this.pulseCard(cardAndElement.card, cardAndElement.element)
        // }
    }

    private pulseCard(card: Card, element: HTMLElement | SVGElement) {
        if (this.tweensPerCard.has(card.id)) {
            return
        }

        this.tweensPerCard.set(
            card.id,
            gsap.to(element, {
                scale: 1.2,
                duration: 1,
                ease: 'power1.inOut',
                yoyo: true,
                repeat: -1
            })
        )
    }

    private stopPulsingCard(id: string, timeline?: gsap.core.Timeline) {
        const tween = this.tweensPerCard.get(id)
        if (tween) {
            tween.kill()
            this.tweensPerCard.delete(id)
            const cardAndElement = this.cards.get(id)
            if (cardAndElement) {
                scale({
                    object: cardAndElement.element,
                    to: 1,
                    duration: 0.2,
                    timeline,
                    position: 0
                })
            }
        }
    }
}

export function animateCard(
    node: HTMLElement | SVGElement,
    params: { animator: CardPickerAnimator; card: Card }
): { destroy: () => void } {
    params.animator.addCard(params.card, node)
    return {
        destroy() {
            params.animator.removeCard(params.card)
        }
    }
}
