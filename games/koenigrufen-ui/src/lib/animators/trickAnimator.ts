import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedKoenigrufenGameState, TrickPlay } from '@tabletop/koenigrufen'
import {
    shownTrickOf,
    trickMotion,
    type ShownTrick,
    type WonTrick
} from '$lib/utils/trickMotion.js'
import { centerOf, register, scaleOf, type CardPlaces } from './cardPlaces.js'

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
// Undo and state-only history: one direct flight, within the 200ms budget.
const FAST_FLIGHT = 0.2

// A card in a hand is drawn at about this fraction of its size in the trick.
const SeatCardScale = 0.36
// A won trick lands at the size of the card drawn on its winner's pile.
const PileCardWidth = 8

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
        const { arriving, won } = trickMotion(from, to)
        const cinematic = action !== undefined && !prefersReducedMotion.current
        // A fast step only flies a single card in; a won trick simply goes.
        const flights = cinematic || (arriving.length === 1 && !won) ? arriving : []
        const shownWon = cinematic ? won : undefined
        if (flights.length === 0 && shownWon === undefined) {
            return
        }
        this.presenter.present(shownWon ?? shownTrickOf(to))
        await tick()

        const timeline = animationContext.actionTimeline
        // The won trick is measured in its places before the last card's flight starts it back
        // in the hand.
        if (shownWon) {
            const landed = flights.length > 0 ? ACTION.flight : 0
            for (const mark of this.marks.values()) {
                timeline.fromTo(
                    mark,
                    { opacity: 0 },
                    { opacity: 1, duration: ACTION.markIn },
                    landed
                )
            }
            this.sweep(shownWon, timeline, landed + ACTION.hold)
        }
        for (const play of flights) {
            this.fly(play, timeline, 0, cinematic ? ACTION.flight : FAST_FLIGHT)
        }
    }

    private fly(play: TrickPlay, timeline: gsap.core.Timeline, at: number, duration: number) {
        const target = this.trickCards.get(play.cardId)
        if (!target) {
            return
        }
        const held = this.places.heldElement(play.cardId)
        const backs = this.places.lastBackOf(play.playerId)
        // A seat without cards drawn (a spectator's own place) sends the card from its name.
        const card = held ?? backs
        const origin = card ?? this.places.seatOf(play.playerId)
        if (!origin) {
            return
        }
        const to = centerOf(target)
        const from = centerOf(origin)
        const scale = scaleOf(target)
        const startScale = card ? from.width / to.width : SeatCardScale
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
                    scale: (PileCardWidth * scale) / from.width,
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
