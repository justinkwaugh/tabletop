import { gsap } from 'gsap'
import { tick } from 'svelte'
import {
    BOARD_GRID,
    isPlaceTrack,
    isScrapTrack,
    type HydratedPromontoryPointGameState,
    type PlaceTrack,
    type RailroadId,
    type ScrapTrack,
    type SpaceId
} from '@tabletop/promontory-point'
import { spaceCentre } from '$lib/utils/boardLayout.js'
import { FlightAnimator, pieceBox } from './flightAnimator.js'
import { FlightKind, type FlightItem, type Hideable } from './flights.svelte.js'
import type { StageSpot } from './flightStage.js'
import { DIRECT_SECONDS, type BoardStateChange } from './markerMotion.js'
import { pieceSettlesAt } from './placementSchedule.js'

// R-3.3: a set-aside piece fades out of the hand this long.
export const SET_ASIDE_FADE_SECONDS = 0.3
// With no hand on screen to leave from, the piece drops onto its hex from this much larger.
const DROP_IN_SCALE = 1.8

const faceUp = (railroadId: RailroadId): FlightItem => ({
    kind: FlightKind.Piece,
    piece: { faceShown: true, railroadId }
})

function placedSpaces(state: HydratedPromontoryPointGameState): Map<SpaceId, RailroadId> {
    return new Map(
        BOARD_GRID.spaces().flatMap(({ spaceId }): [SpaceId, RailroadId][] =>
            spaceId in state.track ? [[spaceId, state.track[spaceId]]] : []
        )
    )
}

// R-3.3: the placed piece flies from the action panel (the deciding seat's own view) or the
// placing seat's card to its hex and settles at pieceSettlesAt(), when its town acts. R-3.3-H1: a
// set-aside piece fades out of the hand. Undo and history fade pieces in or out within 200 ms.
export class TrackPieceAnimator extends FlightAnimator {
    // The hand piece in the panel, for the seat on screen, and in the placing seat's card.
    private handSpots(playerId: string, railroadId: RailroadId): StageSpot[] {
        const panel = this.viewerId() === playerId ? this.stage.turnPiece(railroadId) : undefined
        const seat = this.stage.seatPiece(playerId, railroadId)
        return [panel, seat].flatMap((spot) => (spot ? [spot] : []))
    }

    protected async onGameStateChange(change: BoardStateChange) {
        const { from, to, action } = change
        if (!from) return
        if (!action) return this.direct(change, from, to)
        if (isPlaceTrack(action)) return this.place(change, action)
        if (isScrapTrack(action)) return this.setAside(change, action)
    }

    private async place(change: BoardStateChange, action: PlaceTrack) {
        const { railroadId, spaceId, playerId } = action
        const sources = this.handSpots(playerId, railroadId)
        const hide = sources.map((spot) => spot.element)
        const land = () => this.flights.showLanded(spaceId, railroadId)
        if (this.reducedMotion()) {
            this.flights.hide(hide)
            land()
            return
        }
        const plan = this.plan(change, 'piece')
        const settles = pieceSettlesAt(false)
        const target = this.stage.mapRect(pieceBox(spaceCentre(spaceId)))
        if (!target) {
            plan.at(0, () => this.flights.hide(hide))
            plan.at(settles, land)
            return
        }
        const source = sources.at(0)
        const from = source?.rect ?? {
            left: target.left - (target.width * (DROP_IN_SCALE - 1)) / 2,
            top: target.top - (target.height * (DROP_IN_SCALE - 1)) / 2,
            width: target.width * DROP_IN_SCALE,
            height: target.height * DROP_IN_SCALE
        }
        plan.fly(faceUp(railroadId), from, target, {
            start: 0,
            duration: settles,
            ease: source ? 'power2.inOut' : 'power2.in',
            hide,
            land
        })
        await plan.run()
    }

    private async setAside(change: BoardStateChange, action: ScrapTrack) {
        // Reduced motion: the hand changes with the state, at once.
        if (this.reducedMotion()) return
        const spots = this.handSpots(action.playerId, action.railroadId)
        const plan = this.plan(change, 'set-aside')
        for (const spot of spots) {
            plan.fade(faceUp(action.railroadId), spot.rect, {
                start: 0,
                duration: SET_ASIDE_FADE_SECONDS,
                hide: [spot.element]
            })
        }
        await plan.run()
    }

    // Undo and history: a piece taken off fades out, one put down fades in, at once together.
    private async direct(
        change: BoardStateChange,
        from: HydratedPromontoryPointGameState,
        to: HydratedPromontoryPointGameState
    ) {
        if (this.reducedMotion()) return
        const before = placedSpaces(from)
        const after = placedSpaces(to)
        const timeline = change.animationContext.actionTimeline
        const leaving: Hideable[] = []
        for (const spaceId of before.keys()) {
            if (after.has(spaceId)) continue
            const piece = this.stage.boardPiece(spaceId)
            if (!piece) continue
            leaving.push(piece)
            timeline.to(piece, { opacity: 0, duration: DIRECT_SECONDS, ease: 'power1.in' }, 0)
        }
        if (leaving.length > 0) {
            change.animationContext.afterAnimations(() =>
                gsap.set(leaving, { clearProps: 'opacity' })
            )
        }
        const arriving = [...after].filter(([spaceId]) => !before.has(spaceId))
        if (arriving.length === 0) return
        for (const [spaceId, railroadId] of arriving) this.flights.showLanded(spaceId, railroadId)
        await tick()
        for (const [spaceId] of arriving) {
            const piece = this.stage.boardPiece(spaceId)
            if (!piece) continue
            timeline.fromTo(
                piece,
                { opacity: 0 },
                { opacity: 1, duration: DIRECT_SECONDS, ease: 'power1.out', clearProps: 'opacity' },
                0
            )
        }
    }
}
