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
import { tick } from 'svelte'
import { type GameAction } from '@tabletop/common'
import { ensureDuration, fadeIn, fadeOut, scale } from '$lib/utils/animations.js'
import { Flip } from 'gsap/dist/Flip'
import type { AnimationContext } from '@tabletop/frontend-components'

type CardAndElement = {
    card: Card
    element: HTMLElement | SVGElement
}

export class CardPickerAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private transitioning: boolean = false
    private cards: Map<string, CardAndElement> = new Map()
    private tweensPerCard: Map<string, gsap.core.Tween> = new Map()

    constructor(gameSession: SolGameSession) {
        // console.log('CardPickerAnimator constructor')
        super(gameSession)
    }

    addCard(card: Card, element: HTMLElement | SVGElement): void {
        // console.log('add card to animator:', card.id, card.suit)
        this.cards.set(card.id, { card, element })
        if (!this.transitioning) {
            this.pulseCorrectFlare(this.gameSession.gameState)
        }
    }

    removeCard(card: Card): void {
        this.stopPulsingCard(card.id)
        this.cards.delete(card.id)

        // console.log('remove card from animator:', card.id, card.suit)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action: GameAction
        animationContext: AnimationContext
    }) {
        const undo = to.actionCount < (from?.actionCount ?? 0)
        if (undo) {
            this.pulseCorrectFlare(to)
            return
        }

        // This subtimeline helps us sequence things locally, particularly with the flip
        // animation not being added to the timeline directly
        const subTimeline = gsap.timeline({
            autoRemoveChildren: true
        })

        if (action) {
            await this.animateAction(action, subTimeline, to, from)
        }

        const currentDuration = subTimeline.duration()
        if (action && to.machineState === MachineState.ChoosingCard) {
            subTimeline.add(
                this.transitionToChoosingCards(to, from, animationContext),
                currentDuration
            )
        }
        if (subTimeline.getChildren().length > 0) {
            animationContext.actionTimeline.add(subTimeline, 0)
        }
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
        }
    }

    async animateDrawCards(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        _toState: HydratedSolGameState,
        _fromState?: HydratedSolGameState
    ) {
        // Set the drawn cards so that the card picker will render them
        const drawnCards = action.metadata?.drawnCards ?? []
        const squeezedCards = action.metadata?.squeezedCards ?? []

        const cardsToAnimateMoving = Array.from(this.cards.values()).filter((ce) =>
            squeezedCards.find((sc) => sc.id === ce.card.id)
        )

        // Get the initial state of the squeezed cards
        const squeezedInitialState = Flip.getState(cardsToAnimateMoving.map((ce) => ce.element))
        this.gameSession.drawnCards = [...drawnCards, ...squeezedCards]

        // Wait for cards to appear in dom and be attached to us
        await tick()

        const delayBetween = 0.2
        const flipDuration = 0.3
        const startTime = 0.3

        // Get the destination state of all the cards laid out in a row
        const state = Flip.getState(
            Array.from(this.cards.values())
                .map((ce) => ce.element)
                .reverse()
        )

        // Handle the squeezed cards moving into position
        for (const cardAndElement of cardsToAnimateMoving) {
            Flip.fit(cardAndElement.element, squeezedInitialState, { absolute: true })
            timeline.add(
                Flip.to(state, {
                    duration: flipDuration,
                    ease: 'power1.out',
                    targets: cardAndElement.element
                }),
                startTime
            )
        }

        const cardsToAnimateDrawing = Array.from(this.cards.values()).filter((ce) =>
            drawnCards.find((dc) => dc.id === ce.card.id)
        )

        // Hide newly drawn cards them all and z-order them oppositely
        let zIndex = 0
        for (const cardAndElement of cardsToAnimateDrawing.reverse()) {
            gsap.set(cardAndElement.element, {
                opacity: 0,
                zIndex
            })
            zIndex++
        }

        // At 0.2 seconds (this sucks, but gives time for the board to resize), fit them to the deck position
        timeline.call(
            () => {
                for (const cardAndElement of cardsToAnimateDrawing.reverse()) {
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
        for (const cardAndElement of cardsToAnimateDrawing) {
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

        const fadeDuration = 0.3
        const flipStart = 0.4
        const flipDuration = 0.5

        for (const cardElement of removedCards) {
            fadeOut({
                object: cardElement,
                duration: fadeDuration,
                position: 0
            })
        }

        timeline.call(
            () => {
                this.gameSession.drawnCards = this.gameSession.drawnCards.filter(
                    (card) => card.suit === Suit.Flare
                )
                void tick().then(() => {
                    Flip.from(state, {
                        duration: flipDuration,
                        ease: 'power2.in',
                        onComplete: () => {
                            this.pulseCorrectFlare(fromState ?? toState)
                        },
                        scale: true
                    })
                })
            },
            [],
            flipStart
        )

        ensureDuration(timeline, 2.5)
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

    transitionToChoosingCards(
        to: HydratedSolGameState,
        from: HydratedSolGameState | undefined,
        animationContext: AnimationContext
    ): gsap.core.Timeline {
        const timeline = gsap.timeline()
        const currentPlayerId = to.turnManager.currentTurn()?.playerId
        if (!currentPlayerId) {
            return timeline
        }
        const playerState = from?.getPlayerState(currentPlayerId)
        if (!playerState) {
            return timeline
        }
        const addedCards = from?.machineState === MachineState.SolarFlares
        if (addedCards) {
            // If we are coming from solar flares, we may need to add some cards back in, or at least better detect
            // the remaining card count.

            timeline.call(() => {
                const currentCardElements = Array.from(
                    this.cards.values().map((card) => card.element)
                )
                const state = Flip.getState(currentCardElements)
                this.transitioning = true
                this.gameSession.drawnCards = playerState.drawnCards
                tick()
                    .then(() => {
                        // Stop the pulsing
                        this.pulseCorrectFlare(to)

                        const newTimeline = gsap.timeline()
                        newTimeline.add(
                            Flip.from(state, {
                                duration: 0.5,
                                ease: 'power2.in',
                                scale: true,
                                onComplete: () => {
                                    for (const element of currentCardElements) {
                                        gsap.set(element, { scale: 1 })
                                    }
                                }
                            }),
                            0
                        )
                        const nonSolarCardElements = this.cards
                            .values()
                            .filter((card) => card.card.suit !== Suit.Flare)
                            .map((ce) => ce.element)
                        for (const element of nonSolarCardElements) {
                            gsap.set(element, { opacity: 0 })
                            fadeIn({
                                object: element,
                                timeline: newTimeline,
                                duration: 0.3,
                                position: 0.5
                            })
                        }
                        newTimeline.play()
                    })
                    .catch(() => {})
                    .finally(() => {
                        this.transitioning = false
                    })
            })
            ensureDuration(timeline, 0.8)
        }

        const seenSuits = new Set<Suit>()
        if (playerState.card) {
            seenSuits.add(playerState.card.suit)
        }

        const removedCards = playerState.drawnCards.filter((card) => {
            if (seenSuits.has(card.suit)) {
                return true
            }
            seenSuits.add(card.suit)
            return false
        })

        animationContext.finalTimeline.call(
            () => {
                const lastTimeline = gsap.timeline()
                const removedElements = removedCards
                    .map((card) => this.cards.get(card.id)?.element)
                    .filter((ce) => ce !== undefined)

                const remainingCards = this.gameSession.drawnCards.filter(
                    (card) => !removedCards.find((rc) => rc.id === card.id)
                )
                if (remainingCards.length === 0) {
                    this.gameSession.forcedCallToAction = 'NO NEW CARDS TO CHOOSE FROM...'
                    ensureDuration(animationContext.finalTimeline, 2)
                }

                for (const element of removedElements) {
                    fadeOut({
                        object: element,
                        timeline: lastTimeline,
                        duration: 0.3,
                        position: 0
                    })
                }

                if (remainingCards.length === 0) {
                    lastTimeline.call(
                        () => {
                            this.gameSession.drawnCards = []
                        },
                        [],
                        '>'
                    )
                } else {
                    const durationUntilNow = lastTimeline.duration()
                    lastTimeline.call(
                        () => {
                            const remainingCardElements = remainingCards
                                .map((card) => this.cards.get(card.id)?.element)
                                .filter((ce) => ce !== undefined)
                            const state = Flip.getState(remainingCardElements)
                            this.gameSession.drawnCards = remainingCards
                            tick()
                                .then(() => {
                                    Flip.from(state, {
                                        duration: 0.5,
                                        ease: 'power2.in',
                                        scale: true
                                    })
                                })
                                .catch((err) => {
                                    console.error('Error during tick after choosing card:', err)
                                })
                        },
                        [],
                        '>'
                    )
                    ensureDuration(animationContext.finalTimeline, durationUntilNow + 0.5)
                }
                lastTimeline.play()
            },
            [],
            0
        )

        return timeline
    }

    flareIndexToPulse(state: HydratedSolGameState) {
        if (!state.solarFlares || !state.solarFlaresRemaining) {
            return -1
        }

        return state.solarFlares - state.solarFlaresRemaining
    }

    pulseCorrectFlare(state: HydratedSolGameState) {
        const flares = Array.from(this.cards.values()).filter((ce) => ce.card.suit === Suit.Flare)

        const flareIndex = this.flareIndexToPulse(state)
        for (let i = 0; i < flares.length; i++) {
            const card = flares[i]
            if (i !== flareIndex) {
                this.stopPulsingCard(card.card.id)
            } else {
                this.pulseCard(card.card, card.element)
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
