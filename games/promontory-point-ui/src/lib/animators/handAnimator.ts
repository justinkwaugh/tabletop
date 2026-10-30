import {
    isEndTurn,
    isRevealHand,
    isScrapTrack,
    type HydratedPromontoryPointGameState
} from '@tabletop/promontory-point'
import { seatView, type HandPieceView, type SeatHandView } from '$lib/model/seatView.js'
import { BAG_MOUTH, FlightAnimator, pieceBox } from './flightAnimator.js'
import { FlightKind, type FlightItem, type ScreenRect } from './flights.svelte.js'
import type { FlightPlan } from './flightPlan.js'
import type { BoardStateChange } from './markerMotion.js'

// R-2.2 step 1: each half of a hand piece turning over.
export const REVEAL_HALF_SECONDS = 0.14
// R-5: a drawn piece's flight from the bag, and the gap between one piece and the next.
export const DRAW_FLIGHT_SECONDS = 0.5
export const DRAW_STAGGER_SECONDS = 0.12
// R-3.3-H1: the replacement leaves the bag as the set-aside piece fades.
export const REPLACEMENT_STARTS_AT = 0.15

const CONCEALED: HandPieceView = { faceShown: false }

const asItem = (piece: HandPieceView | undefined): FlightItem => ({
    kind: FlightKind.Piece,
    piece: piece ?? CONCEALED
})

// R-2.2 step 1, R-5: the turn player's grey discs turn over to their railroads for every seat
// that saw them concealed. R-2.2 step 4, R-3.3-H1, R-5: a draw flies discs from the bag to the
// drawer's seat card, faces to the drawer and grey to others. Each hand is shown as it ends up
// once its motion is over; undo and history leave hands to the state.
export class HandAnimator extends FlightAnimator {
    private hand(state: HydratedPromontoryPointGameState, playerId: string): SeatHandView {
        return seatView(state, playerId, this.viewerId()).hand
    }

    protected async onGameStateChange(change: BoardStateChange) {
        const { from, to, action } = change
        if (!from || !action) return
        if (isRevealHand(action)) return this.reveal(change, from, to, action.playerId)
        if (isEndTurn(action)) {
            return this.draw(change, to, action.playerId, action.metadata?.drawnCount ?? 0, 0)
        }
        if (isScrapTrack(action) && action.metadata?.replacement !== undefined) {
            return this.draw(change, to, action.playerId, 1, REPLACEMENT_STARTS_AT)
        }
    }

    private async reveal(
        change: BoardStateChange,
        from: HydratedPromontoryPointGameState,
        to: HydratedPromontoryPointGameState,
        playerId: string
    ) {
        const before = this.hand(from, playerId)
        const after = this.hand(to, playerId)
        // The seat's own hand is already drawn face up.
        if (before.pieces.every((piece) => piece.faceShown)) return
        if (this.reducedMotion()) {
            this.flights.showHand(playerId, after)
            return
        }
        const plan = this.plan(change, 'reveal')
        let turned = 2 * REVEAL_HALF_SECONDS
        for (const [index, spot] of this.stage.seatHandPieces(playerId).entries()) {
            turned = plan.flip(
                asItem(before.pieces[index]),
                asItem(after.pieces[index]),
                spot.rect,
                {
                    start: 0,
                    halfSeconds: REVEAL_HALF_SECONDS,
                    hide: [spot.element]
                }
            )
        }
        plan.at(turned, () => this.flights.showHand(playerId, after))
        await plan.run()
    }

    // The last `count` pieces of the drawer's hand come from the bag.
    private async draw(
        change: BoardStateChange,
        to: HydratedPromontoryPointGameState,
        playerId: string,
        count: number,
        start: number
    ) {
        if (count === 0) return
        const after = this.hand(to, playerId)
        if (this.reducedMotion()) {
            this.flights.showHand(playerId, after)
            return
        }
        const plan = this.plan(change, 'draw')
        const first = after.pieces.length - count
        const bag = this.stage.mapRect(pieceBox(BAG_MOUTH))
        // The hand as it ends up takes over the seat card's pieces, a set-aside one among them.
        const shownPieces = this.stage.seatHandPieces(playerId).map((spot) => spot.element)
        for (let drawn = 0; drawn < count; drawn++) {
            const index = first + drawn
            const leaves = start + drawn * DRAW_STAGGER_SECONDS
            const land = () => {
                this.flights.showHand(playerId, {
                    ...after,
                    pieces: after.pieces.slice(0, index + 1)
                })
                this.flights.unhide(shownPieces)
            }
            this.flyDrawn(plan, after.pieces[index], bag, playerId, index, leaves, land)
        }
        await plan.run()
    }

    private flyDrawn(
        plan: FlightPlan,
        piece: HandPieceView | undefined,
        bag: ScreenRect | undefined,
        playerId: string,
        index: number,
        start: number,
        land: () => void
    ) {
        const slot = this.stage.seatHandSlot(playerId, index)
        if (!bag || !slot) {
            plan.at(start + DRAW_FLIGHT_SECONDS, land)
            return
        }
        plan.fly(asItem(piece), bag, slot, {
            start,
            duration: DRAW_FLIGHT_SECONDS,
            ease: 'power2.out',
            land
        })
    }
}
