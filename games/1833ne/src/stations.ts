import * as Type from 'typebox'
import {
    StationAccess,
    StationReservation,
    marketDiscardOrder,
    type PhaseRules,
    type StationRules
} from '@tabletop/18xx'
import { Map1833NE, Places } from './map.js'
import { TileSet1833NE } from './tiles.js'
import { Market1833NE } from './stock.js'
import { TrainRetirementRules } from './trains.js'
import { FerryBonusMarker, OwnedFerry, type FerryState } from './ferries.js'
import { holdsRightsOf } from './takeoverState.js'

/**
 * The B&W's spot in Worcester and the B&P's in Boston's green tile, kept from others until
 * phase IV (§6.53).
 */
export const ReservedCitySpots: readonly StationReservation[] = [
    { companyId: 'B&W', locationId: Places.worcester, nodeId: 'city' },
    { companyId: 'B&P', locationId: Places.boston, nodeId: 'city-1' }
]

export const StationCost = 80
/** A B&W token in Worcester always costs $40 (§6.53). */
export const WorcesterCost = 40

export const StationRules1833NE: StationRules = {
    map: Map1833NE,
    tileSet: TileSet1833NE,
    pendingHomes: () => [],
    placementLimit: () => 1,
    placementCost(state, _stationId, context) {
        return context &&
            holdsRightsOf(state, context.companyId, 'B&W') &&
            context.position.locationId === Places.worcester
            ? WorcesterCost
            : StationCost
    }
}

/** What phase IV takes: the ferries and their bonus, the reservations and the Ogdensburg's access. */
export const PhaseChanges1833NE = Type.Object(
    {
        removedFerries: Type.Array(OwnedFerry),
        removedFerryBonus: Type.Optional(FerryBonusMarker),
        removedReservations: Type.Array(StationReservation),
        removedStationAccess: Type.Array(StationAccess)
    },
    { additionalProperties: false }
)
export type PhaseChanges1833NE = Type.Static<typeof PhaseChanges1833NE>

type PhaseState = Parameters<NonNullable<PhaseRules['changes']>['apply']>[0] & FerryState

export const PhaseRules1833NE: PhaseRules = {
    ...TrainRetirementRules,
    discardOrder: (state, companyId) => marketDiscardOrder(Market1833NE, state, companyId),
    discardDestination: 'market',
    changes: {
        schema: PhaseChanges1833NE,
        apply(state: PhaseState): PhaseChanges1833NE {
            if (state.phaseId !== 'IV')
                return { removedFerries: [], removedReservations: [], removedStationAccess: [] }
            const removedFerries = state.ferries
            const removedFerryBonus = state.ferryBonus
            state.ferries = []
            delete state.ferryBonus
            // A taken-over corporation's spot is its acquirer's until then (§11.7).
            const removedReservations = state.stationReservations.filter((reservation) =>
                ReservedCitySpots.some(
                    (spot) =>
                        spot.locationId === reservation.locationId &&
                        spot.nodeId === reservation.nodeId
                )
            )
            state.stationReservations = state.stationReservations.filter(
                (reservation) => !removedReservations.includes(reservation)
            )
            const removedStationAccess = (state.stationAccess ?? []).filter(
                (access) => access.sourceId === 'P4'
            )
            state.stationAccess = state.stationAccess?.filter((access) => access.sourceId !== 'P4')
            return {
                removedFerries,
                ...(removedFerryBonus ? { removedFerryBonus } : {}),
                removedReservations,
                removedStationAccess
            }
        }
    }
}
