import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    isChooseTalonHalf,
    isDealHand,
    isLayAway,
    type HydratedKoenigrufenGameState
} from '@tabletop/koenigrufen'
import {
    defenderCollector,
    talonGoesToDefenders,
    talonViewOf,
    type TalonView
} from '$lib/utils/talonView.js'
import { centerOf, scaleOf, type CardPlaces, type Center } from './cardPlaces.js'
import { layoutWidthOf, type CardFlights, type Flight } from './flights.js'

const REVEAL = {
    // Each card slides out of the stack to its place in a half, then turns face up.
    slide: 0.4,
    stagger: 0.07,
    turn: 0.14
}
const LEAVE = { flight: 0.6, stagger: 0.06 }
const GLIDE = 0.5
const LAY_AWAY = { flight: 0.45, stagger: 0.06, fade: 0.3 }
// Undo and state-only history: every card straight to its new place at once, within the 200ms
// budget.
const DIRECT = 0.2

type Timeline = AnimationContext['actionTimeline']

type TalonPresenter = {
    // Presence only: shows the talon as `view` before the state swap.
    presentTalon(view: TalonView): void
}

type Change = {
    from?: HydratedKoenigrufenGameState
    to: HydratedKoenigrufenGameState
    action?: GameAction
    animationContext: AnimationContext
}

function faceUpCards(view: TalonView): string[] {
    switch (view.kind) {
        case 'halves':
            return view.halves.flat()
        case 'half':
            return view.cards
        default:
            return []
    }
}

// The talon's moves. Dealt face down to the middle, it turns up there as two halves when the
// contract calls for it. Before play, cards the declarer takes fly into the declarer's hand, cards
// for the defenders to the first opponent after the declarer, and the rest glide to the corner to
// wait. Laid-away cards leave the declarer's hand. Undo and history move every card straight to
// where the step leaves it.
export class TalonAnimator {
    constructor(
        private places: CardPlaces,
        private flights: CardFlights,
        private presenter: TalonPresenter
    ) {}

    async onGameStateChange(change: Change) {
        const { from, to, action, animationContext } = change
        if (!from) {
            return
        }
        if (!action) {
            await this.step(from, to, animationContext)
            return
        }
        if (prefersReducedMotion.current || isDealHand(action)) {
            return
        }
        if (isLayAway(action)) {
            const laidAway =
                from.getPlayerState(action.playerId).handCount -
                to.getPlayerState(action.playerId).handCount
            await this.layAway(action.playerId, action.cardIds, laidAway, animationContext)
            return
        }
        const before = talonViewOf(from)
        const after = talonViewOf(to)
        if (JSON.stringify(before) === JSON.stringify(after)) {
            return
        }

        // Measure the talon where it is, before it is drawn in its new place.
        const stack = this.places.talonStackElement()
        const stackAt = stack ? centerOf(stack) : undefined
        const backs = stack ? [...stack.querySelectorAll(':scope > .back')] : []
        const cardsAt = new Map(
            faceUpCards(before).flatMap((cardId) => {
                const element = this.places.talonCardOf(cardId)
                return element ? [[cardId, centerOf(element)] as const] : []
            })
        )
        const taken = new Set(isChooseTalonHalf(action) ? action.cardIds : [])
        const flights = this.leaving(before, after, to, taken, backs, action.id, LEAVE)
        const shown = this.flights.show(flights, animationContext)
        this.presenter.presentTalon(after)
        await tick()

        const timeline = animationContext.actionTimeline
        if (shown) {
            this.flights.start(shown, timeline)
        }
        if (before.kind === 'stack' && after.kind === 'halves' && stackAt) {
            this.reveal(after.halves.flat(), stackAt, timeline)
        } else if (before.kind === 'stack' && after.kind === 'stack' && stackAt) {
            const moved = this.places.talonStackElement()
            if (moved) {
                this.glide(moved, stackAt, timeline)
            }
        } else {
            for (const cardId of faceUpCards(after)) {
                const element = this.places.talonCardOf(cardId)
                const at = cardsAt.get(cardId)
                if (element && at) {
                    this.glide(element, at, timeline)
                }
            }
        }
    }

    // Talon cards leaving the table: the declarer's half or the Sechserdreier talon to the
    // declarer, the defenders' to their collector. The taken half goes first.
    private leaving(
        before: TalonView,
        after: TalonView,
        to: HydratedKoenigrufenGameState,
        taken: ReadonlySet<string>,
        backs: Element[],
        keyPrefix: string,
        timing: { flight: number; stagger: number }
    ): Flight[] {
        const declarerId = to.contract?.declarerId
        if (declarerId === undefined) {
            return []
        }
        const declarer = this.flights.landingFor(declarerId)
        const collectorId = defenderCollector(to)
        const collectorSeat =
            collectorId === undefined ? undefined : this.places.seatOf(collectorId)
        const defenders = collectorSeat ? { element: collectorSeat } : undefined
        const staying = new Set(faceUpCards(after))
        const pieces: { key: string; cardId?: string; element: Element; toDeclarer: boolean }[] = []
        for (const cardId of faceUpCards(before)) {
            const element = this.places.talonCardOf(cardId)
            if (element && !staying.has(cardId)) {
                pieces.push({
                    key: `${keyPrefix}-${cardId}`,
                    cardId,
                    element,
                    toDeclarer: taken.has(cardId)
                })
            }
        }
        if (before.kind === 'stack' && after.kind === 'gone') {
            const toDeclarer = to.contractDefinition().talonCards === 6
            backs.forEach((element, index) => {
                pieces.push({ key: `${keyPrefix}-back-${index}`, element, toDeclarer })
            })
        }
        pieces.sort((a, b) => Number(b.toDeclarer) - Number(a.toDeclarer))
        return pieces.flatMap(({ key, cardId, element, toDeclarer }, index) => {
            const landing = toDeclarer ? declarer : defenders
            return landing
                ? [
                      {
                          key,
                          ...(cardId === undefined ? {} : { cardId }),
                          from: { element, cardWidth: layoutWidthOf(element) },
                          to: landing,
                          at: index * timing.stagger,
                          duration: timing.flight
                      }
                  ]
                : []
        })
    }

    // The stack's cards slide out to their places in the halves, then each turns face up.
    private reveal(cardIds: string[], stack: Center, timeline: Timeline) {
        cardIds.forEach((cardId, index) => {
            const card = this.places.talonCardOf(cardId)
            const back = card?.querySelector('.flip-back')
            if (!card || !back) {
                return
            }
            const place = centerOf(card)
            const scale = scaleOf(card)
            const at = index * REVEAL.stagger
            const turnAt = at + REVEAL.slide
            timeline.fromTo(
                card,
                { x: (stack.x - place.x) / scale, y: (stack.y - place.y) / scale },
                { x: 0, y: 0, duration: REVEAL.slide, ease: 'power2.out' },
                at
            )
            // Face down until it has landed: narrow to an edge, show the face, open out again.
            timeline.fromTo(
                back,
                { opacity: 1 },
                { opacity: 0, duration: 0.01 },
                turnAt + REVEAL.turn
            )
            timeline.fromTo(
                card,
                { scaleX: 1 },
                { scaleX: 0, duration: REVEAL.turn, ease: 'power1.in' },
                turnAt
            )
            timeline.to(
                card,
                { scaleX: 1, duration: REVEAL.turn, ease: 'power1.out', clearProps: 'transform' },
                turnAt + REVEAL.turn
            )
        })
    }

    // Moves `element` from where it was drawn (`was`) to where it is now, resizing on the way.
    private glide(element: HTMLElement, was: Center, timeline: Timeline, duration = GLIDE) {
        const now = centerOf(element)
        const scale = scaleOf(element)
        timeline.fromTo(
            element,
            {
                x: (was.x - now.x) / scale,
                y: (was.y - now.y) / scale,
                scale: now.width > 0 ? was.width / now.width : 1
            },
            {
                x: 0,
                y: 0,
                scale: 1,
                duration,
                ease: 'power2.inOut',
                clearProps: 'transform'
            },
            0
        )
    }

    // Without an action's story (Undo, history, a correction), every talon card and every card I
    // lay away or take back goes straight to where the step leaves it, all at once. A step across
    // deals moves nothing: the cards are a new deal's.
    private async step(
        from: HydratedKoenigrufenGameState,
        to: HydratedKoenigrufenGameState,
        context: AnimationContext
    ) {
        if (from.dealNumber() !== to.dealNumber()) {
            return
        }
        const timeline = context.actionTimeline
        const viewer = to.players.find((player) => this.flights.isViewer(player.playerId))
        const before = talonViewOf(from)
        const after = talonViewOf(to)
        const talonMoves = JSON.stringify(before) !== JSON.stringify(after)

        // Measure everything where it is, before it is drawn in its new place.
        const stack = this.places.talonStackElement()
        const stackAt = stack ? centerOf(stack) : undefined
        const backs = stack ? [...stack.querySelectorAll(':scope > .back')] : []
        const cardsAt = new Map(
            faceUpCards(before).flatMap((cardId) => {
                const element = this.places.talonCardOf(cardId)
                return element ? [[cardId, centerOf(element)] as const] : []
            })
        )
        const myHandBefore = new Set(
            viewer ? (from.getPlayerState(viewer.playerId).hand ?? []) : []
        )
        const heldAt = new Map(
            faceUpCards(after).flatMap((cardId) => {
                const held = myHandBefore.has(cardId) ? this.places.heldElement(cardId) : undefined
                return held ? [[cardId, { held, at: centerOf(held) }] as const] : []
            })
        )

        const flights: Flight[] = talonMoves ? this.homeward(before, after, to, backs) : []
        if (viewer) {
            flights.push(...this.myLaidAway(viewer.playerId, from, to, timeline))
        }
        const shown = this.flights.show(flights, context)
        if (talonMoves) {
            this.presenter.presentTalon(after)
        }
        await tick()

        if (shown) {
            this.flights.start(shown, timeline)
        }
        if (!talonMoves) {
            return
        }
        for (const cardId of faceUpCards(after)) {
            const element = this.places.talonCardOf(cardId)
            const held = heldAt.get(cardId)
            if (held) {
                // It leaves my hand as it sets off; the state swap removes it there for good.
                timeline.set(held.held, { opacity: 0 }, 0)
            }
            const was =
                cardsAt.get(cardId) ??
                held?.at ??
                (before.kind === 'stack' ? stackAt : undefined) ??
                this.seatCenter(this.holderOf(cardId, from))
            if (element && was) {
                this.glide(element, was, timeline, DIRECT)
            }
        }
        const moved = after.kind === 'stack' ? this.places.talonStackElement() : undefined
        if (moved) {
            const was =
                before.kind === 'stack'
                    ? stackAt
                    : before.kind === 'gone'
                      ? this.seatCenter(this.holderOf(undefined, from))
                      : undefined
            if (was) {
                this.glide(moved, was, timeline, DIRECT)
            }
        }
    }

    // Talon cards a direct step takes off the table: into the stack they were turned up from, or
    // to whoever the step gives them.
    private homeward(
        before: TalonView,
        after: TalonView,
        to: HydratedKoenigrufenGameState,
        backs: Element[]
    ): Flight[] {
        const timing = { flight: DIRECT, stagger: 0 }
        if (before.kind === 'halves' && after.kind === 'stack') {
            const slot = this.places.talonSlotElement(after.place)
            return slot
                ? faceUpCards(before).flatMap((cardId) => {
                      const element = this.places.talonCardOf(cardId)
                      return element
                          ? [
                                {
                                    key: `direct-${cardId}`,
                                    cardId,
                                    from: { element, cardWidth: layoutWidthOf(element) },
                                    to: { element: slot },
                                    at: 0,
                                    duration: DIRECT
                                }
                            ]
                          : []
                  })
                : []
        }
        const rejected = new Set(to.rejectedTalonHalf ?? [])
        const taken = new Set(
            to.rejectedTalonHalf === undefined
                ? []
                : (to.talonHalves ?? []).flat().filter((cardId) => !rejected.has(cardId))
        )
        return this.leaving(before, after, to, taken, backs, 'direct', timing)
    }

    // Who holds a talon card, or the face-down talon, that a direct step brings back to the table:
    // the declarer, unless it had gone to the defenders. Sechserdreier's declarer picks it all up.
    private holderOf(
        cardId: string | undefined,
        from: HydratedKoenigrufenGameState
    ): string | undefined {
        const declarerId = from.contract?.declarerId
        if (declarerId === undefined || from.contractDefinition().talonCards === 6) {
            return declarerId
        }
        const rejected = from.rejectedTalonHalf ?? []
        const toDefenders =
            talonGoesToDefenders(from) && (cardId === undefined || rejected.includes(cardId))
        return toDefenders ? defenderCollector(from) : declarerId
    }

    private seatCenter(playerId: string | undefined): Center | undefined {
        if (playerId === undefined) {
            return undefined
        }
        const element = this.places.lastBackOf(playerId) ?? this.places.seatOf(playerId)
        return element ? centerOf(element) : undefined
    }

    // Cards I lay away go from my hand to my seat; cards a step takes back come from my seat to my
    // hand, which draws them once the state swaps.
    private myLaidAway(
        playerId: string,
        from: HydratedKoenigrufenGameState,
        to: HydratedKoenigrufenGameState,
        timeline: Timeline
    ): Flight[] {
        const before = from.getPlayerState(playerId)
        const after = to.getPlayerState(playerId)
        const seat = this.places.seatOf(playerId)
        const hand = this.flights.landingFor(playerId)
        if (!seat || !hand) {
            return []
        }
        const handBefore = new Set(before.hand ?? [])
        const handAfter = new Set(after.hand ?? [])
        const laid = (after.discards ?? []).filter((cardId) => handBefore.has(cardId))
        const takenBack = (before.discards ?? []).filter((cardId) => handAfter.has(cardId))
        const flights: Flight[] = []
        for (const cardId of laid) {
            const held = this.places.heldElement(cardId)
            if (!held) {
                continue
            }
            timeline.set(held, { opacity: 0 }, 0)
            flights.push({
                key: `direct-layaway-${cardId}`,
                cardId,
                from: { element: held, cardWidth: layoutWidthOf(held) },
                to: { element: seat },
                at: 0,
                duration: DIRECT
            })
        }
        for (const cardId of takenBack) {
            flights.push({
                key: `direct-takeback-${cardId}`,
                cardId,
                from: { element: seat },
                to: hand,
                at: 0,
                duration: DIRECT
            })
        }
        return flights
    }

    // My laid-away cards fly from my hand to my seat; another declarer's seat lets that many backs go.
    private async layAway(
        declarerId: string,
        cardIds: readonly string[] | undefined,
        count: number,
        context: AnimationContext
    ) {
        const timeline = context.actionTimeline
        if (!this.flights.isViewer(declarerId) || !cardIds) {
            this.places
                .backsOf(declarerId)
                .slice(-count)
                .forEach((back, index) => {
                    timeline.to(
                        back,
                        { opacity: 0, y: -12, duration: LAY_AWAY.fade, ease: 'power1.in' },
                        index * LAY_AWAY.stagger
                    )
                })
            return
        }
        const seat = this.places.seatOf(declarerId)
        if (!seat) {
            return
        }
        const flights: Flight[] = []
        cardIds.forEach((cardId, index) => {
            const held = this.places.heldElement(cardId)
            if (!held) {
                return
            }
            const at = index * LAY_AWAY.stagger
            // The card leaves the hand as its copy sets off; the state swap removes it for good.
            timeline.set(held, { opacity: 0 }, at)
            flights.push({
                key: `layaway-${cardId}`,
                cardId,
                from: { element: held, cardWidth: layoutWidthOf(held) },
                to: { element: seat },
                at,
                duration: LAY_AWAY.flight
            })
        })
        await this.flights.launch(flights, timeline, context)
    }
}
