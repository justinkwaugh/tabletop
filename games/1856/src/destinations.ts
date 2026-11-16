import { ActionSource, assert } from '@tabletop/common'
import {
    CashPayment,
    RailwayMapState,
    SystemActionFirstHandler,
    getCompany,
    homeStationId,
    reachRoutes,
    rotateTileFace,
    settleCashPayments,
    systemAction,
    type RevenueCenter
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { capitalizationOnSale, companyFunding } from './capitalization.js'
import { MajorIds1856, major1856, type Destination1856 } from './companies.js'
import { Map1856 } from './map.js'
import { requireState1856, type HydratedState1856, type StateHandler1856 } from './state.js'
import { TileSet1856 } from './tiles.js'

/** The company's destination in this game, standard or alternate (Variants). */
export function destination1856(state: HydratedState1856, companyId: string): Destination1856 {
    const company = major1856(companyId)
    assert(company, `${companyId} has no destination`)
    return state.variants.alternateDestinations ? company.alternateDestination : company.destination
}

/** The places a company's destination names, the map's markers for it. */
export function destinationMarkers1856(
    stateObject: object
): { locationId: string; kind: string }[] {
    const state = requireState1856(stateObject)
    return destinationsWatched(state).flatMap((companyId) =>
        destination1856(state, companyId).locationIds.map((locationId) => ({
            locationId,
            kind: destinationMarkerKind(companyId)
        }))
    )
}

export function destinationMarkerKind(companyId: string): string {
    return `destination:${companyId}`
}

/** Where the company's destination route starts: its home station, or the place it names. */
function routeOrigins(state: HydratedState1856, companyId: string): RevenueCenter[] {
    const mapState = new RailwayMapState(Map1856, TileSet1856, state.tileInventory)
    const from = destination1856(state, companyId).from
    if (from)
        return mapState
            .tile(from)
            .face.nodes.filter((node) => node.kind !== 'junction')
            .map((node) => ({ locationId: from, nodeId: node.id }))
    const station = state.stations.find((entry) => entry.id === homeStationId(companyId))
    if (station?.status === 'placed')
        return [{ locationId: station.position.locationId, nodeId: station.position.nodeId }]
    const reservation = state.stationReservations.find((entry) => entry.companyId === companyId)
    if (reservation) return [{ locationId: reservation.locationId, nodeId: reservation.nodeId }]
    return (state.hexReservations ?? [])
        .filter((entry) => entry.companyId === companyId)
        .flatMap(({ locationId }) =>
            mapState
                .tile(locationId)
                .face.nodes.filter((node) => node.kind === 'city')
                .map((node) => ({ locationId, nodeId: node.id }))
        )
}

/**
 * A company reaches its destination once a legal route runs from its home station to the
 * destination, whatever its length and whatever other companies' stations stand on the way
 * (Public Company Starting Treasury).
 */
export function reachesDestination(state: HydratedState1856, companyId: string): boolean {
    const targets = destination1856(state, companyId).locationIds
    const mapState = new RailwayMapState(Map1856, TileSet1856, state.tileInventory)
    let reached = false
    reachRoutes(
        Map1856,
        (locationId) => {
            const tile = mapState.tile(locationId)
            return rotateTileFace(tile.face, tile.rotation)
        },
        routeOrigins(state, companyId),
        () => false,
        {
            reached(locationId, endpoint) {
                if (endpoint.kind === 'node' && targets.includes(locationId)) reached = true
            }
        }
    )
    return reached
}

/**
 * The companies whose destinations still matter: escrow companies holding back payments, and,
 * while new companies start in escrow, those not yet started.
 */
export function destinationsWatched(state: HydratedState1856): string[] {
    const escrowStarts = capitalizationOnSale(state) === 'escrow'
    return MajorIds1856.filter((companyId) => {
        if (state.destinationsReached.includes(companyId)) return false
        const company = getCompany(state, companyId)
        if (company.closed) return false
        if (!company.started) return escrowStarts
        return companyFunding(state, companyId)?.capitalization === 'escrow'
    })
}

function destinationsDue(state: HydratedState1856): string[] {
    return destinationsWatched(state).filter((companyId) => reachesDestination(state, companyId))
}

const ReachDestinationAction = systemAction('ReachDestination', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(
        Type.Object({ release: Type.Optional(CashPayment) }, { additionalProperties: false })
    )
})
export const ReachDestination = ReachDestinationAction.schema
export type ReachDestination = Type.Static<typeof ReachDestination>
export const isReachDestination = ReachDestinationAction.is

/** Reaching its destination releases the company's escrow at once, whoever laid the tile. */
class HydratedReachDestination extends ReachDestinationAction.Base implements ReachDestination {
    declare type: 'ReachDestination'
    declare companyId: string
    declare metadata?: ReachDestination['metadata']
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && destinationsDue(state).includes(this.companyId),
            'Destinations are reached by the system as track joins them'
        )
        const funding = companyFunding(state, this.companyId)
        const release: CashPayment | undefined = funding?.escrow
            ? {
                  from: { kind: 'bank' },
                  to: { kind: 'company', companyId: this.companyId },
                  amount: funding.escrow
              }
            : undefined
        if (release) settleCashPayments(state, [release])
        if (funding) delete funding.escrow
        state.destinationsReached = [...state.destinationsReached, this.companyId]
        this.metadata = release ? { release } : {}
    }
}

export const DestinationActions1856 = [
    ReachDestinationAction.define((action) => new HydratedReachDestination(action))
]

/** After any tile, every destination it completes is reached. */
export function reachesDestinations(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(handler, ReachDestination, (stateObject) => {
        const [companyId] = destinationsDue(requireState1856(stateObject))
        return companyId ? { companyId } : undefined
    })
}
