import type { gsap } from 'gsap'
import type { RailroadId, SpaceId } from '@tabletop/promontory-point'
import type { HandPieceView, SeatHandView } from '$lib/model/seatView.js'

// A rectangle on screen, in CSS pixels from the viewport's top left (getBoundingClientRect's).
export type ScreenRect = { left: number; top: number; width: number; height: number }

export enum FlightKind {
    Piece = 'Piece',
    Share = 'Share'
}

// What a moving copy draws: a hand piece as its perspective shows it (R-5), or a share card.
export type FlightItem =
    | { kind: FlightKind.Piece; piece: HandPieceView }
    | { kind: FlightKind.Share; railroadId: RailroadId }

// One moving copy, drawn by the flight layer at `rect` and moved by its animator.
export type Flight = { id: string; item: FlightItem; rect: ScreenRect }

// An element on the table a flight stands in for while it moves: hidden, then shown again.
export type Hideable = { style: { visibility: string } }

// A copy's element, or in a spec any object GSAP can tween.
export type FlightElement = gsap.TweenTarget

const seatShareKey = (playerId: string, railroadId: RailroadId) => `${playerId}|${railroadId}`

// Contract, "In-flight pieces": the moving copies the state-change animators draw across the
// scaling wrapper, the table's elements they hide, and what the table shows once each lands
// while the state on screen still waits (Pattern C). Presence only; no game meaning is read here.
// The copies live for one replayed action; what has landed lives until the next shown state.
export class Flights {
    flights: Flight[] = $state([])

    // R-3.3: pieces that have landed on their hex before the state that holds them is shown.
    landedPieces: Partial<Record<SpaceId, RailroadId>> = $state({})

    // R-2.2 step 1, R-5: a hand as the table shows it once its reveal or draw has played.
    hands: Record<string, SeatHandView> = $state({})

    // R-3.1, R-3.2, R-4.3: share counts once each card has landed.
    private seatShares: Record<string, number> = $state({})
    private deckCounts: Partial<Record<RailroadId, number>> = $state({})

    private elements = new Map<string, FlightElement>()
    private hidden = new Set<Hideable>()

    launch(flights: Flight[]) {
        this.flights = [...this.flights, ...flights]
    }

    // The action whose copies these are has played: they leave the layer.
    remove(ids: readonly string[]) {
        const leaving = new Set(ids)
        this.flights = this.flights.filter((flight) => !leaving.has(flight.id))
    }

    element(id: string): FlightElement | undefined {
        return this.elements.get(id)
    }

    setElement(id: string, element: FlightElement | undefined) {
        if (element) this.elements.set(id, element)
        else this.elements.delete(id)
    }

    hide(elements: readonly Hideable[]) {
        for (const element of elements) {
            element.style.visibility = 'hidden'
            this.hidden.add(element)
        }
    }

    unhide(elements: readonly Hideable[]) {
        for (const element of elements) {
            if (!this.hidden.delete(element)) continue
            element.style.visibility = ''
        }
    }

    isHidden(element: Hideable): boolean {
        return this.hidden.has(element)
    }

    showLanded(spaceId: SpaceId, railroadId: RailroadId) {
        this.landedPieces = { ...this.landedPieces, [spaceId]: railroadId }
    }

    showHand(playerId: string, hand: SeatHandView) {
        this.hands = { ...this.hands, [playerId]: hand }
    }

    showSeatShares(playerId: string, railroadId: RailroadId, count: number) {
        this.seatShares = { ...this.seatShares, [seatShareKey(playerId, railroadId)]: count }
    }

    showDeckCount(railroadId: RailroadId, count: number) {
        this.deckCounts = { ...this.deckCounts, [railroadId]: count }
    }

    seatShareCount(playerId: string, railroadId: RailroadId): number | undefined {
        return this.seatShares[seatShareKey(playerId, railroadId)]
    }

    deckCount(railroadId: RailroadId): number | undefined {
        return this.deckCounts[railroadId]
    }

    // An interruption (the layer unmounting, full screen opening or closing): nothing is left
    // in flight and nothing on the table stays hidden.
    interrupt() {
        this.flights = []
        this.unhide([...this.hidden])
    }

    // The new state is on screen: it shows everything that landed, so nothing overrides it.
    stateShown() {
        this.interrupt()
        this.landedPieces = {}
        this.hands = {}
        this.seatShares = {}
        this.deckCounts = {}
    }
}

export function registerFlight(node: HTMLElement, params: { flights: Flights; id: string }) {
    params.flights.setElement(params.id, node)
    return {
        destroy() {
            if (params.flights.element(params.id) === node)
                params.flights.setElement(params.id, undefined)
        }
    }
}
