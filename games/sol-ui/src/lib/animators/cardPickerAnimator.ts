import {
    Card,
    DrawCards,
    HydratedSolGameState,
    isActivate,
    isDrawCards,
    isPass,
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
import { ActionSource, type GameAction } from '@tabletop/common'
import { ensureDuration, fadeIn, fadeOut, scale } from '$lib/utils/animations.js'
import { Flip } from 'gsap/dist/Flip'
import { fade } from 'svelte/transition'

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
        action,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action: GameAction
        timeline: gsap.core.Timeline
    }) {
        // This subtimeline helps us sequence things locally, particularly with the flip
        // animation not being added to the timeline directly
        const subTimeline = gsap.timeline({
            autoRemoveChildren: true
        })
        if (action) {
            await this.animateAction(action, subTimeline, to, from)
        }

        if (to.machineState === MachineState.SolarFlares) {
            // for (const { card, element } of this.cards.values()) {
            //     if (card.suit !== Suit.Flare) {
            //         continue
            //     }
            //     this.pulseCard(card, element)
            // }
        } else {
            const pulseIds = Array.from(this.tweensPerCard.keys())
            for (const id of pulseIds) {
                this.stopPulsingCard(id, timeline)
            }
            this.tweensPerCard.clear()
        }

        if (to.machineState === MachineState.ChoosingCard) {
            console.log('CardPickerAnimator: Going to ChoosingCard state')
            const currentPlayerId = to.turnManager.currentTurn()?.playerId
            if (!currentPlayerId) {
                return
            }
            const playerState = from?.getPlayerState(currentPlayerId)
            if (!playerState) {
                return
            }

            const seenSuits = new Set<Suit>()
            if (playerState.card) {
                seenSuits.add(playerState.card.suit)
            }
            console.log('CardPickerAnimator: finding removed cards to fade out')
            const removedCards = this.gameSession.drawnCards.filter((card) => {
                if (seenSuits.has(card.suit)) {
                    return true
                }
                seenSuits.add(card.suit)
                return false
            })

            console.log(`CardPickerAnimator: fading out ${removedCards.length} removed cards`)
            const removedElements = removedCards
                .map((card) => this.cards.get(card.id)?.element)
                .filter((ce) => ce !== undefined)

            for (const element of removedElements) {
                fadeOut({
                    object: element,
                    duration: 0.3,
                    timeline: subTimeline,
                    position: '<'
                })
            }

            const remainingCards = this.gameSession.drawnCards.filter(
                (card) => !removedCards.find((rc) => rc.id === card.id)
            )

            if (remainingCards.length === 0) {
                const durationUntilNow = subTimeline.duration()
                subTimeline.call(
                    () => {
                        this.gameSession.forcedCallToAction = 'NO NEW CARDS TO CHOOSE FROM...'
                        this.gameSession.drawnCards = []
                    },
                    [],
                    durationUntilNow
                )
                ensureDuration(subTimeline, 3)
            } else {
                const remainingCardElements = remainingCards
                    .map((card) => this.cards.get(card.id)?.element)
                    .filter((ce) => ce !== undefined)

                const durationUntilNow = subTimeline.duration()
                subTimeline.call(
                    () => {
                        const state = Flip.getState(remainingCardElements)
                        this.gameSession.drawnCards = remainingCards

                        tick().then(() => {
                            Flip.from(state, {
                                duration: 0.5,
                                ease: 'power2.in'
                            })
                        })
                    },
                    [],
                    durationUntilNow
                )
                ensureDuration(subTimeline, durationUntilNow + 0.3)
            }
        }
        timeline.add(subTimeline, 0)
    }

    async animateAction(
        action: GameAction,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (isDrawCards(action)) {
            await this.animateDrawCards(action, timeline, toState, fromState)
        } else if (isSolarFlare(action)) {
            await this.animateSolarFlare(action, timeline, toState, fromState)
        } else if (isActivate(action)) {
            // Delay for informational display
            // ensureDuration(timeline, 1.5)
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
        // Get the initial state of the cards laid out in a row

        const allCards = Array.from(this.cards.values()).map((ce) => ce.element)
        const removedCards = this.cards
            .values()
            .filter((ce) => ce.card.suit !== Suit.Flare)
            .map((ce) => ce.element)

        const state = Flip.getState(allCards)

        console.log('SolarFlare: fading')
        for (const cardElement of removedCards) {
            fadeOut({
                object: cardElement,
                duration: 0.3,
                position: 0
            })
        }

        timeline.call(
            () => {
                console.log('SolarFlare: removing non-flare cards from drawnCards')
                this.gameSession.drawnCards = this.gameSession.drawnCards.filter(
                    (card) => card.suit === Suit.Flare
                )
                tick().then(() => {
                    console.log('SolarFlare: flip em')
                    Flip.from(state, {
                        duration: 0.5,
                        ease: 'power2.in',
                        onComplete: () => {
                            const firstFlare = this.cards
                                .values()
                                .find((ce) => ce.card.suit === Suit.Flare)
                            if (firstFlare) {
                                this.pulseCard(firstFlare.card, firstFlare.element)
                            }
                        }
                    })
                })
            },
            [],
            0.3
        )

        const durationUntilNow = timeline.duration()
        ensureDuration(timeline, durationUntilNow + 0.3)
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
