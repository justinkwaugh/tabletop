import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { GameAction } from '@tabletop/common'
import {
    StationReservation,
    advancePhaseSchema,
    marketDiscardOrder,
    type AdvancePhaseSchema,
    operatingPlayerIds,
    type PhaseRules
} from '@tabletop/18xx'
import { releaseStationReservations } from './stations.js'
import { AdditionalReservations } from './map.js'
import { RevenueMarker } from './revenueMarkers.js'
import { ReceivershipRules1846 } from './receivership.js'
import { RailroadClosure, closeRailroad } from './closeCorporation.js'
import { SteamboatAssignment } from './steamboat.js'
import { Market1846 } from './stock.js'
import type { HydratedEighteenFortySixState } from './state.js'

/** What a phase takes with it: the independents and Steamboat at III, markers and reservations at IV. */
export const PhaseChanges1846 = Type.Object(
    {
        closedRailroads: Type.Array(RailroadClosure),
        removedReservations: Type.Array(StationReservation),
        removedRevenueMarkers: Type.Array(RevenueMarker),
        removedSteamboat: Type.Optional(SteamboatAssignment)
    },
    { additionalProperties: false }
)
export type PhaseChanges1846 = Type.Static<typeof PhaseChanges1846>

export const PhaseRules1846: PhaseRules = {
    activePlayers: (state, companyId) =>
        operatingPlayerIds(state, companyId, ReceivershipRules1846),
    rustTiming: (state, train) => {
        if (state.phaseId === 'IV') {
            if (train.definitionId === '2') return 'immediate'
            if (['4', '3/5'].includes(train.definitionId)) return 'after-operation'
        }
        return state.phaseId === 'III' && train.definitionId === '2' ? 'after-operation' : undefined
    },
    discardOrder: (state, companyId) => marketDiscardOrder(Market1846, state, companyId),
    discardDestination: 'market',
    changes: {
        schema: PhaseChanges1846,
        apply(state: HydratedEighteenFortySixState): PhaseChanges1846 {
            const closing = state.phaseId === 'III'
            const removedSteamboat = closing && state.steamboat ? { ...state.steamboat } : undefined
            const closedRailroads = closing
                ? state.companies
                      .filter((company) => company.kind === 'minor' && !company.closed)
                      .map((company) => closeRailroad(state, company.id))
                : []
            if (closing) delete state.steamboat
            const final = state.phaseId === 'IV'
            const removedRevenueMarkers = final ? state.revenueMarkers : []
            if (final) state.revenueMarkers = []
            const removedReservations = final
                ? releaseStationReservations(state, (reservation) =>
                      AdditionalReservations.some(
                          (additional) =>
                              additional.companyId === reservation.companyId &&
                              additional.locationId === reservation.locationId
                      )
                  )
                : []
            return {
                closedRailroads,
                removedReservations,
                removedRevenueMarkers,
                ...(removedSteamboat ? { removedSteamboat } : {})
            }
        }
    }
}

export const AdvancePhase1846: AdvancePhaseSchema<typeof PhaseChanges1846> =
    advancePhaseSchema(PhaseChanges1846)
export type AdvancePhase1846 = Type.Static<typeof AdvancePhase1846>
const Validator = Compile(AdvancePhase1846)
export function isAdvancePhase1846(action: GameAction): action is AdvancePhase1846 {
    return action.type === 'AdvancePhase' && Validator.Check(action)
}
