import {
    isBuyShare,
    isPayRepairs,
    isSellShare,
    type HydratedPromontoryPointGameState,
    type RailroadId
} from '@tabletop/promontory-point'
import { SEA_SLOTS } from '$lib/utils/boardGeometry.js'
import { FlightAnimator } from './flightAnimator.js'
import { FlightKind, type FlightItem, type Hideable } from './flights.svelte.js'
import type { FlightPlan } from './flightPlan.js'
import type { BoardStateChange } from './markerMotion.js'

// R-3.1, R-3.2: a share card's flight between its deck and a seat card.
export const SHARE_FLIGHT_SECONDS = 0.5
// R-4.3: the debtor's cards leave one after another, in the order they were sold.
export const SALE_STAGGER_SECONDS = 0.15
// A seat card's stack draws at most this many cards, however many are held.
const STACK_CARDS = 4

type Move = {
    railroadId: RailroadId
    start: number
    // Counts once this card has landed.
    seatCount: number
    deckCount: number
    // Counts before this card left, which decide what it leaves behind.
    seatBefore: number
    deckBefore: number
    // The card's place in its stack, from the top, among this action's cards of its railroad.
    fromTop: number
}

// R-3.1: a bought card flies from its deck in the sea to the buyer's seat card; R-3.2, R-4.3: a
// sold or distress-sold card flies back. Each count changes as its card lands; the card it
// leaves behind is hidden while it flies. Undo and history change counts with the state.
export class ShareCardAnimator extends FlightAnimator {
    protected async onGameStateChange(change: BoardStateChange) {
        const { from, action } = change
        if (!from || !action) return
        if (isBuyShare(action)) {
            return this.move(change, from, action.playerId, [action.railroadId], 'buy')
        }
        if (isSellShare(action)) {
            return this.move(change, from, action.playerId, [action.railroadId], 'sell')
        }
        if (isPayRepairs(action)) {
            const sales = (action.metadata?.sales ?? []).map((sale) => sale.railroadId)
            return this.move(change, from, action.playerId, sales, 'sell')
        }
    }

    private async move(
        change: BoardStateChange,
        from: HydratedPromontoryPointGameState,
        playerId: string,
        railroadIds: RailroadId[],
        way: 'buy' | 'sell'
    ) {
        if (railroadIds.length === 0) return
        const step = way === 'buy' ? 1 : -1
        const moved = new Map<RailroadId, number>()
        const moves: Move[] = railroadIds.map((railroadId, order) => {
            const earlier = moved.get(railroadId) ?? 0
            moved.set(railroadId, earlier + 1)
            const seatBefore = from.getPlayerState(playerId).shares[railroadId] + earlier * step
            const deckBefore = from.shareDeckCount(railroadId) - earlier * step
            return {
                railroadId,
                start: order * SALE_STAGGER_SECONDS,
                seatBefore,
                deckBefore,
                seatCount: seatBefore + step,
                deckCount: deckBefore - step,
                fromTop: earlier
            }
        })
        const land = (move: Move, shown: readonly Hideable[]) => () => {
            this.flights.showSeatShares(playerId, move.railroadId, move.seatCount)
            this.flights.showDeckCount(move.railroadId, move.deckCount)
            this.flights.unhide(shown)
        }
        if (this.reducedMotion()) {
            for (const move of moves) land(move, [])()
            return
        }
        const plan = this.plan(change, `share-${way}`)
        for (const move of moves) this.fly(plan, playerId, move, way, land)
        await plan.run()
    }

    private fly(
        plan: FlightPlan,
        playerId: string,
        move: Move,
        way: 'buy' | 'sell',
        land: (move: Move, shown: readonly Hideable[]) => () => void
    ) {
        const { railroadId, start } = move
        const deck = this.stage.mapRect(SEA_SLOTS.decks[railroadId])
        const cards = this.stage.seatShareCards(playerId, railroadId)
        const card = cards.at(-1 - Math.min(move.fromTop, cards.length - 1))
        if (!deck || !card) {
            plan.at(start + SHARE_FLIGHT_SECONDS, land(move, []))
            return
        }
        // The card that moves is the deck's last, or a card the seat's stack stops drawing.
        const deckFace = this.stage.deckFace(railroadId)
        const hide =
            way === 'buy'
                ? move.deckBefore === 1 && deckFace
                    ? [deckFace.element]
                    : []
                : move.seatBefore <= STACK_CARDS && move.seatBefore > 0
                  ? [card.element]
                  : []
        const item: FlightItem = { kind: FlightKind.Share, railroadId }
        const [source, target] = way === 'buy' ? [deck, card.rect] : [card.rect, deck]
        plan.fly(item, source, target, {
            start,
            duration: SHARE_FLIGHT_SECONDS,
            ease: 'power2.inOut',
            hide,
            land: land(move, hide)
        })
    }
}
