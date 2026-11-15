import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import type { AnimationContext } from '@tabletop/frontend-components'
import { centerOf, register, scaleOf, type CardPlaces } from './cardPlaces.js'

// A card or packet flying over the table, placed in board pixels where it sets off. Face up when
// `cardId` is known; otherwise `count` card backs, slightly fanned (one by default).
export type FlyingCard = {
    key: string
    cardId?: string
    count?: number
    left: number
    top: number
    width: number
}

export type FlightPresenter = {
    // Presence only: adds flying cards before the state swap; `clear` removes them all after.
    show(cards: FlyingCard[]): void
    clear(): void
    isViewer(playerId: string): boolean
}

// Where a flight starts or ends: an element's centre, at the width of the card drawn there.
export type CardSpot = { element: Element; cardWidth?: number }

export type Flight = {
    key: string
    cardId?: string
    count?: number
    from: CardSpot
    to: CardSpot
    at: number
    duration: number
}

type Timeline = AnimationContext['actionTimeline']

export type ShownFlights = {
    flights: Flight[]
    cards: FlyingCard[]
    boardScale: number
    origin: DOMRect
    seatWidth: number
}

// Cards are drawn this tall for their width.
const CardAspect = 9 / 5
// The 5:9 width a drawn card is laid out for, read from its height: cards of either pack stand
// equally tall, though each pack's own width is narrower.
export function layoutWidthOf(element: Element): number {
    return element.getBoundingClientRect().height / CardAspect
}

// A card's width in a seat's stack of backs, for a spot that draws none, and in my hand.
const SeatCardWidth = 37
const HandCardWidth = 112

// Draws cards over the table and flies them from one spot to another, fading as they land. The
// state swap then shows them where they arrived.
export class CardFlights {
    private flying = new Map<string, HTMLElement>()

    constructor(
        private places: CardPlaces,
        private presenter: FlightPresenter
    ) {}

    attach(key: string): Attachment<HTMLElement> {
        return register(this.flying, key)
    }

    isViewer(playerId: string): boolean {
        return this.presenter.isViewer(playerId)
    }

    // A player's cards land in my hand when they are mine, else on their seat's backs.
    landingFor(playerId: string): CardSpot | undefined {
        const hand = this.isViewer(playerId) ? this.places.myHandElement() : undefined
        if (hand) {
            // An empty hand (before a deal) lands its cards at a hand card's size.
            const card = hand.querySelector('.card')
            const width = card ? layoutWidthOf(card) : HandCardWidth * scaleOf(hand)
            return { element: hand, cardWidth: width }
        }
        const back = this.places.lastBackOf(playerId)
        if (back) {
            return { element: back, cardWidth: layoutWidthOf(back) }
        }
        const seat = this.places.seatOf(playerId)
        return seat ? { element: seat } : undefined
    }

    async launch(flights: Flight[], timeline: Timeline, context: AnimationContext) {
        const shown = this.show(flights, context)
        if (shown) {
            await tick()
            this.start(shown, timeline)
        }
    }

    // Draws the flights' cards where they set off. Once they have rendered, `start` sends them.
    show(flights: Flight[], context: AnimationContext): ShownFlights | undefined {
        const board = this.places.boardElement()
        if (!board || flights.length === 0) {
            return undefined
        }
        const boardScale = scaleOf(board)
        const origin = board.getBoundingClientRect()
        const seatWidth = SeatCardWidth * boardScale
        const cards = flights.map((flight) => {
            const start = centerOf(flight.from.element)
            const width = flight.from.cardWidth ?? seatWidth
            return {
                key: flight.key,
                ...(flight.cardId === undefined ? {} : { cardId: flight.cardId }),
                ...(flight.count === undefined ? {} : { count: flight.count }),
                left: (start.x - width / 2 - origin.left) / boardScale,
                top: (start.y - (width * CardAspect) / 2 - origin.top) / boardScale,
                width: width / boardScale
            }
        })
        this.presenter.show(cards)
        context.afterAnimations(() => this.presenter.clear())
        return { flights, cards, boardScale, origin, seatWidth }
    }

    start({ flights, cards, boardScale, origin, seatWidth }: ShownFlights, timeline: Timeline) {
        flights.forEach((flight, index) => {
            const element = this.flying.get(flight.key)
            const card = cards[index]
            if (!element || !card) {
                return
            }
            const target = centerOf(flight.to.element)
            const startX = origin.left + (card.left + card.width / 2) * boardScale
            const startY = origin.top + (card.top + (card.width * CardAspect) / 2) * boardScale
            const width = flight.to.cardWidth ?? seatWidth
            timeline.to(
                element,
                {
                    x: (target.x - startX) / boardScale,
                    y: (target.y - startY) / boardScale,
                    scale: width / (card.width * boardScale),
                    duration: flight.duration,
                    ease: 'power2.inOut'
                },
                flight.at
            )
            timeline.to(element, { opacity: 0, duration: 0.12 }, flight.at + flight.duration - 0.12)
        })
    }
}
