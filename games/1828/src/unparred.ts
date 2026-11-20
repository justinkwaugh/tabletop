import { ActionSource, assert } from '@tabletop/common'
import {
    RailwayMapState,
    SystemActionFirstHandler,
    getCompany,
    systemAction,
    type Station
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { MajorIds1828 } from './companies.js'
import { Map1828 } from './map.js'
import type { HydratedState1828, StateHandler1828 } from './state.js'
import { TileSet1828 } from './tiles.js'
import { PurplePhaseId, Phases1828 } from './trains.js'

const Id = Type.String({ minLength: 1 })

const RemoveUnparredCompaniesAction = systemAction('RemoveUnparredCompanies', {
    metadata: Type.Optional(
        Type.Object(
            { companyIds: Type.Array(Id), blockingStationIds: Type.Array(Id) },
            { additionalProperties: false }
        )
    )
})
export const RemoveUnparredCompanies = RemoveUnparredCompaniesAction.schema
export type RemoveUnparredCompanies = Type.Static<typeof RemoveUnparredCompanies>
export const isRemoveUnparredCompanies = RemoveUnparredCompaniesAction.is

function unparredCompanyIds(state: HydratedState1828): string[] {
    return MajorIds1828.filter((companyId) => {
        const company = getCompany(state, companyId)
        return !company.started && !company.closed
    })
}

function removalDue(state: HydratedState1828): boolean {
    return (
        state.machineState === 'StockRound' &&
        !state.stockRound.completed &&
        Phases1828.isAtLeast(state.phaseId, PurplePhaseId) &&
        unparredCompanyIds(state).length > 0
    )
}

/**
 * At the start of the first stock round in purple phase, the companies never parred leave the
 * game, blocking stations taking their homes, both of Buffalo/Dunkirk's for the Erie (§7.1,
 * §17.7).
 */
class HydratedRemoveUnparredCompanies
    extends RemoveUnparredCompaniesAction.Base
    implements RemoveUnparredCompanies
{
    declare type: 'RemoveUnparredCompanies'
    declare metadata?: RemoveUnparredCompanies['metadata']
    apply(state: HydratedState1828): void {
        assert(this.source === ActionSource.System && removalDue(state), 'No removal is due')
        const companyIds = unparredCompanyIds(state)
        const mapState = new RailwayMapState(Map1828, TileSet1828, state.tileInventory)
        const blocking: Station[] = []
        for (const companyId of companyIds) {
            getCompany(state, companyId).closed = true
            const reservations = state.stationReservations.filter(
                (reservation) => reservation.companyId === companyId
            )
            reservations.forEach((reservation, index) => {
                const node = mapState
                    .tile(reservation.locationId)
                    .face.nodes.find((entry) => entry.id === reservation.nodeId)
                const taken = state.stations.filter(
                    (station) =>
                        station.status === 'placed' &&
                        station.position.locationId === reservation.locationId &&
                        station.position.nodeId === reservation.nodeId
                ).length
                if (node?.kind !== 'city' || taken >= node.stationSlots) return
                blocking.push({
                    id: `${companyId}:blocking:${index}`,
                    companyId,
                    status: 'placed',
                    position: {
                        locationId: reservation.locationId,
                        nodeId: reservation.nodeId,
                        slot: taken
                    }
                })
            })
        }
        state.stations = [...state.stations, ...blocking]
        state.stationReservations = state.stationReservations.filter(
            (reservation) => !companyIds.includes(reservation.companyId)
        )
        this.metadata = { companyIds, blockingStationIds: blocking.map((station) => station.id) }
    }
}

/** The first purple stock round opens by removing the unparred companies. */
export function removesUnparredCompanies(handler: StateHandler1828): StateHandler1828 {
    return new SystemActionFirstHandler(handler, RemoveUnparredCompanies, (state) =>
        removalDue(state) ? {} : undefined
    )
}

export const UnparredActions1828 = [
    RemoveUnparredCompaniesAction.define((action) => new HydratedRemoveUnparredCompanies(action))
]
