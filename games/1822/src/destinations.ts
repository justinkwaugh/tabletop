import {
    RouteEvaluation,
    actsFor,
    connectedWithin,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    systemAction,
    type RevenueCenter
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { LnwrId, destinationStationId, major1822 } from './companies.js'
import { RouteRules1822 } from './routes.js'
import type { HydratedState1822 } from './state.js'
import { stationsAt1822, tokenSpace1822 } from './tokens.js'

/**
 * The major company that has just joined its home to its destination: it places its destination
 * token there, or the LNWR's Manchester station becomes one (§5.11.1–§5.11.4).
 */
export function destinationDue1822(state: HydratedState1822): { companyId: string } | undefined {
    const companyId = nextOperatingCompany(state)
    const major = companyId ? major1822(companyId) : undefined
    if (!companyId || !major || !getCompany(state, companyId).floated) return undefined
    const stationId = destinationStationId(companyId)
    const placed = state.stations.some(
        (station) => station.id === stationId && station.status === 'placed'
    )
    if (companyId === LnwrId ? state.lnwrConnected || !placed : placed) return undefined
    const { network } = new RouteEvaluation(state, RouteRules1822)
    return connectedWithin(network, state, companyId, major.home, major.destination, Infinity)
        ? { companyId }
        : undefined
}

/**
 * Places a major company's destination token in its destination city, free (§5.11.1, §5.11.8).
 * Where the company already has a station there, as one placed in an acquired minor company's
 * home, that station becomes its destination station instead, as the LNWR's Manchester station
 * does (§5.11.3): a placed station is never moved (§5.12.8), a company has one station in a city
 * (§5.12.6), and the destination token stays off the map.
 */
export function placeDestinationToken1822(
    state: HydratedState1822,
    companyId: string,
    destination: RevenueCenter
): { locationId: string; nodeId: string; slot: number; stationId?: string } {
    const destinationId = destinationStationId(companyId)
    const existing = stationsAt1822(state, destination).find(
        (station) => station.companyId === companyId && station.id !== homeStationId(companyId)
    )
    if (existing) {
        state.stations = state.stations.map((station) =>
            station.id === existing.id ? { ...existing, id: destinationId } : station
        )
        return { ...destination, slot: existing.position.slot, stationId: existing.id }
    }
    const slot = tokenSpace1822(state, companyId, destination)
    state.stations.push({
        id: destinationId,
        companyId,
        status: 'placed',
        position: { ...destination, slot }
    })
    return { ...destination, slot }
}

const ReachDestinationAction = systemAction('ReachDestination', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(
        Type.Object(
            {
                locationId: Type.String(),
                nodeId: Type.String(),
                /** Absent for the LNWR, whose token already stands in Manchester (§5.11.3). */
                slot: Type.Optional(Type.Integer({ minimum: 0 })),
                /**
                 * The company's station already in the city, which became its destination station
                 * in place of the token (§5.12.6, §5.12.8).
                 */
                stationId: Type.Optional(Type.String())
            },
            { additionalProperties: false }
        )
    )
})
export const ReachDestination = ReachDestinationAction.schema
export type ReachDestination = Type.Static<typeof ReachDestination>
export const isReachDestination = ReachDestinationAction.is

/** After its track, a major company joined to its destination places its destination token, free (§5.11.1). */
export class HydratedReachDestination extends ReachDestinationAction.Base {
    declare companyId: ReachDestination['companyId']
    declare metadata?: ReachDestination['metadata']
    apply(state: HydratedState1822): void {
        assert(
            this.source === ActionSource.System &&
                destinationDue1822(state)?.companyId === this.companyId &&
                (!this.playerId || actsFor(state, this.playerId, this.companyId)),
            'A destination is reached by the operating company that has just joined it'
        )
        const major = major1822(this.companyId)
        assertExists(major, 'Only a major company has a destination')
        if (this.companyId === LnwrId) {
            state.lnwrConnected = true
            this.metadata = { ...major.destination }
            return
        }
        this.metadata = placeDestinationToken1822(state, this.companyId, major.destination)
    }
}

export const ReachDestinationDefinition = ReachDestinationAction.define(
    (action) => new HydratedReachDestination(action)
)
