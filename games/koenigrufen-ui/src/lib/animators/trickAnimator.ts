import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedKoenigrufenGameState } from '@tabletop/koenigrufen'
import {
    directTrickStep,
    shownTrickOf,
    trickMotion,
    type ShownTrick,
    type TrickMove,
    type WonTrick
} from '$lib/utils/trickMotion.js'
import { centerOf, register, scaleOf, type CardPlaces } from './cardPlaces.js'
import { layoutWidthOf, type CardFlights, type Flight } from './flights.js'

const ACTION = {
    // A played card's flight from the hand to its place in the trick.
    flight: 0.42,
    // A won trick stays this long once its last card lands, its winning card ringed.
    hold: 1,
    // Then it slides to its winner's pile, each card a little after the last.
    sweep: 0.5,
    sweepStagger: 0.04,
    markIn: 0.15,
    landFade: 0.08
}
// Undo, state-only history and reduced motion: direct flights together, within the 200ms budget.
const FAST_FLIGHT = 0.2

// A card in a hand is drawn at about this fraction of its size in the trick.
const SeatCardScale = 0.36
// A won trick lands at the size of the card drawn on its winner's pile. The pile is measured
// where it is drawn; this is its width for a seat that draws none.
const PileCardWidth = 18

type TrickPresenter = {
    // Presence only: draws `trick` on the table before the state swap.
    present(trick: ShownTrick): void
}

// Cards fly from where they were held to their place in the trick. The card that completes a trick
// lands, the winning card is ringed and the winner named for a moment, then the trick slides to its
// winner's pile. Motion is written straight to each trick card's `fly` wrapper, which holds no other
// transform.
export class TrickAnimator {
    private trickCards = new Map<string, HTMLElement>()
    // The winning card's ring and the caption naming the winner.
    private marks = new Map<string, HTMLElement>()

    constructor(
        private places: CardPlaces,
        private flights: CardFlights,
        private presenter: TrickPresenter
    ) {}

    trickCard(cardId: string): Attachment<HTMLElement> {
        return register(this.trickCards, cardId)
    }

    winnerMark(key: 'ring' | 'caption'): Attachment<HTMLElement> {
        return register(this.marks, key)
    }

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedKoenigrufenGameState
        to: HydratedKoenigrufenGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from) {
            return
        }
        if (action === undefined || prefersReducedMotion.current) {
            await this.step(from, to, animationContext)
            return
        }
        const { arriving, won } = trickMotion(from, to)
        if (arriving.length === 0 && won === undefined) {
            return
        }
        this.presenter.present(won ?? shownTrickOf(to))
        await tick()

        const timeline = animationContext.actionTimeline
        // The won trick is measured in its places before the last card's flight starts it back
        // in the hand.
        if (won) {
            const landed = arriving.length > 0 ? ACTION.flight : 0
            for (const mark of this.marks.values()) {
                timeline.fromTo(
                    mark,
                    { opacity: 0 },
                    { opacity: 1, duration: ACTION.markIn },
                    landed
                )
            }
            this.sweep(won, timeline, landed + ACTION.hold)
        }
        for (const play of arriving) {
            this.fly({ play }, timeline, 0, ACTION.flight)
        }
    }

    // Without an action's story, every card goes straight to its new place at once: into the
    // trick from a hand, or from the pile of a won trick taken back, and back to a hand from the
    // trick or that pile. A trick the step wins simply goes.
    private async step(
        from: HydratedKoenigrufenGameState,
        to: HydratedKoenigrufenGameState,
        animationContext: AnimationContext
    ) {
        const { arriving, leaving } = directTrickStep(from, to)
        if (arriving.length === 0 && leaving.length === 0) {
            return
        }
        // Cards going back to a hand are measured where they are, then drawn over the table, before
        // the trick shows the state the step ends on.
        const shown = this.flights.show(
            leaving.flatMap((move) => this.homeward(move)),
            animationContext
        )
        this.presenter.present(shownTrickOf(to))
        await tick()

        const timeline = animationContext.actionTimeline
        if (shown) {
            this.flights.start(shown, timeline)
        }
        for (const move of arriving) {
            this.fly(move, timeline, 0, FAST_FLIGHT)
        }
    }

    // A card's flight from the trick, or from a pile, back to its player's hand.
    private homeward({ play, pileOf }: TrickMove): Flight[] {
        const to = this.flights.landingFor(play.playerId)
        const element =
            pileOf === undefined ? this.trickCards.get(play.cardId) : this.pileOf(pileOf)
        if (!to || !element) {
            return []
        }
        const cardWidth =
            pileOf === undefined
                ? layoutWidthOf(element.querySelector('.card') ?? element)
                : this.pileCardWidth(pileOf, scaleOf(element))
        return [
            {
                key: `back-${play.cardId}`,
                cardId: play.cardId,
                from: { element, cardWidth },
                to,
                at: 0,
                duration: FAST_FLIGHT
            }
        ]
    }

    private pileOf(playerId: string): HTMLElement | undefined {
        return this.places.trickPileOf(playerId) ?? this.places.seatOf(playerId)
    }

    // The on-screen width of the card drawn on a player's pile.
    private pileCardWidth(playerId: string, scale: number): number {
        const pile = this.places.trickPileOf(playerId)
        return pile ? centerOf(pile).width : PileCardWidth * scale
    }

    // A card's flight into its place in the trick: from where it was held, or from the pile of a
    // won trick taken back.
    private fly(
        { play, pileOf }: TrickMove,
        timeline: gsap.core.Timeline,
        at: number,
        duration: number
    ) {
        const target = this.trickCards.get(play.cardId)
        if (!target) {
            return
        }
        const pile = pileOf === undefined ? undefined : this.pileOf(pileOf)
        const held = pile ? undefined : this.places.heldElement(play.cardId)
        const backs = pile ? undefined : this.places.lastBackOf(play.playerId)
        // A seat without cards drawn (a spectator's own place) sends the card from its name.
        const card = held ?? backs
        const origin = pile ?? card ?? this.places.seatOf(play.playerId)
        if (!origin) {
            return
        }
        const to = centerOf(target)
        const from = centerOf(origin)
        const scale = scaleOf(target)
        const startScale =
            pileOf !== undefined
                ? this.pileCardWidth(pileOf, scale) / to.width
                : card
                  ? from.width / to.width
                  : SeatCardScale
        // The card leaves its hand upright and turns into its place's tilt as it lands.
        const tilt = Number(target.dataset.tilt ?? 0)
        if (card) {
            // It leaves the hand as it sets off; the state swap then removes it for good.
            timeline.set(card, { opacity: 0 }, at)
        }
        timeline.fromTo(
            target,
            {
                x: (from.x - to.x) / scale,
                y: (from.y - to.y) / scale,
                scale: startScale,
                rotation: -tilt
            },
            {
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0,
                duration,
                ease: 'power2.out',
                clearProps: 'transform'
            },
            at
        )
    }

    private sweep(trick: WonTrick, timeline: gsap.core.Timeline, at: number) {
        const pile = this.places.trickPileOf(trick.winnerId) ?? this.places.seatOf(trick.winnerId)
        if (!pile) {
            return
        }
        const to = centerOf(pile)
        const caption = this.marks.get('caption')
        if (caption) {
            timeline.to(caption, { opacity: 0, duration: ACTION.markIn }, at)
        }
        trick.plays.forEach((play, index) => {
            const card = this.trickCards.get(play.cardId)
            if (!card) {
                return
            }
            const from = centerOf(card)
            const scale = scaleOf(card)
            const start = at + index * ACTION.sweepStagger
            timeline.to(
                card,
                {
                    x: (to.x - from.x) / scale,
                    y: (to.y - from.y) / scale,
                    scale: this.pileCardWidth(trick.winnerId, scale) / from.width,
                    duration: ACTION.sweep,
                    ease: 'power2.inOut'
                },
                start
            )
            // Into the pile, which the state swap then counts.
            timeline.to(
                card,
                { opacity: 0, duration: ACTION.landFade },
                start + ACTION.sweep - ACTION.landFade
            )
        })
    }
}
