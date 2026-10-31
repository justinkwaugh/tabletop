import type { BoundingBox, Point } from '@tabletop/common'
import { TRACK_PIECE_RADIUS } from '$lib/utils/boardLayout.js'
import { BAG_COUNT_Y, STRIP_SLOTS } from '$lib/utils/boardGeometry.js'
import type { Flights } from './flights.svelte.js'
import { FlightPlan } from './flightPlan.js'
import { PIECE_EXTENT, type FlightStage } from './flightStage.js'
import { StateAnimator } from './stateAnimator.js'
import type { BoardAnimationHost, BoardStateChange } from './markerMotion.js'

// What every flight animator is handed: the session's listeners, the presence it writes, the
// stage it reads and the seat on screen.
export type FlightHost = {
    host: BoardAnimationHost
    flights: Flights
    stage: FlightStage
    viewerId: () => string | undefined
    reducedMotion?: () => boolean
}

// A piece's moving copy around a point in map units, as wide as a hand piece's extent.
export function pieceBox(centre: Point): BoundingBox {
    const half = TRACK_PIECE_RADIUS * PIECE_EXTENT
    return { x: centre.x - half, y: centre.y - half, width: half * 2, height: half * 2 }
}

// R-5: drawn pieces leave the bag at its mouth: the count on the strip's bag card.
export const BAG_MOUTH: Point = {
    x: STRIP_SLOTS.bag.x + STRIP_SLOTS.bag.width / 2,
    y: STRIP_SLOTS.bag.y + BAG_COUNT_Y
}

// One state-change animator whose motion crosses the scaling wrapper through the flight layer.
// It listens while the layer is mounted; the layer unmounting interrupts every flight.
export abstract class FlightAnimator extends StateAnimator {
    protected readonly flights: Flights
    protected readonly stage: FlightStage
    protected readonly viewerId: () => string | undefined

    constructor(hosting: FlightHost) {
        super(hosting.host, hosting.reducedMotion)
        this.flights = hosting.flights
        this.stage = hosting.stage
        this.viewerId = hosting.viewerId
    }

    protected clear() {
        this.flights.interrupt()
    }

    protected plan(change: BoardStateChange, name: string): FlightPlan {
        return new FlightPlan(
            this.flights,
            change.animationContext,
            `${change.action?.id ?? 'direct'}:${name}`
        )
    }
}
