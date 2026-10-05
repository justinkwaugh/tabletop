import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type MachineStateHandler
} from '@tabletop/common'
import {
    CompanyChanges,
    CompanyChangeRecorder,
    PhaseEvent,
    StationReservation,
    advancePhase,
    continuePhaseChange,
    applyPrivateEffects,
    marketDiscardOrder,
    privateOwningCompany,
    type PhaseRules,
    type PrivateEffect
} from '@tabletop/18xx'
import { releasePrivateReservations, releaseStationReservations } from './stations.js'
import { AdditionalReservations } from './map.js'
import { RevenueMarker } from './revenueMarkers.js'
import { operatingPlayers1846 } from './receivership.js'
import { RailroadClosure, closeRailroad } from './closeCorporation.js'
import { SteamboatAssignment } from './steamboat.js'
import { TrainRules1846 } from './trains.js'
import { StockRules1846 } from './stock.js'
import type { HydratedEighteenFortySixState } from './state.js'

export const PhaseRules1846: PhaseRules = {
    activePlayers: operatingPlayers1846,
    rustTiming: (state, train) => {
        if (state.phaseId === 'IV') {
            if (train.definitionId === '2') return 'immediate'
            if (['4', '3/5'].includes(train.definitionId)) return 'after-operation'
        }
        return state.phaseId === 'III' && train.definitionId === '2' ? 'after-operation' : undefined
    },
    discardOrder: marketDiscardOrder,
    discardDestination: 'market'
}
const Fields = Type.Object({
    type: Type.Literal('AdvancePhase'),
    source: Type.Literal(ActionSource.System),
    metadata: Type.Optional(
        Type.Object(
            {
                event: PhaseEvent,
                nextState: Type.String(),
                companyChanges: Type.Optional(CompanyChanges),
                closedRailroads: Type.Array(RailroadClosure),
                removedReservations: Type.Array(StationReservation),
                removedRevenueMarkers: Type.Array(RevenueMarker),
                removedSteamboat: Type.Optional(SteamboatAssignment)
            },
            { additionalProperties: false }
        )
    )
})
export const AdvancePhase1846: Type.TObject<
    Omit<typeof GameAction.properties, 'type' | 'source'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
const Validator = Compile(AdvancePhase1846)
export function isAdvancePhase1846(
    action: GameAction
): action is Type.Static<typeof AdvancePhase1846> {
    return action.type === 'AdvancePhase' && Validator.Check(action)
}
export class AdvancePhase1846Action extends HydratableAction<typeof AdvancePhase1846> {
    declare metadata?: Type.Static<typeof AdvancePhase1846>['metadata']
    constructor(data: Type.Static<typeof AdvancePhase1846>) {
        super(data, Validator)
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.source === ActionSource.System &&
                state.phaseChange &&
                state.phaseChange.event.fromPhaseId === state.phaseId,
            'Phase advancement requires a pending phase'
        )
        const changes = new CompanyChangeRecorder(state)
        const closedRailroads: RailroadClosure[] = []
        const closing = state.phaseChange.event.toPhaseId === 'III'
        const removedSteamboat = closing && state.steamboat ? { ...state.steamboat } : undefined
        if (closing) {
            for (const company of state.companies)
                if (company.kind === 'minor' && !company.closed)
                    closedRailroads.push(closeRailroad(state, company.id))
            delete state.steamboat
        }
        const event = advancePhase(state, PhaseRules1846, TrainRules1846)
        event.privateEffects = closing
            ? state.companies.flatMap((company): PrivateEffect[] =>
                  company.kind === 'private' &&
                  !company.closed &&
                  !(company.id === 'MAIL' && privateOwningCompany(state, company.id))
                      ? [{ kind: 'close', privateCompanyId: company.id }]
                      : []
              )
            : []
        applyPrivateEffects(state, event.privateEffects, StockRules1846)
        const removedReservations = releasePrivateReservations(
            state,
            event.privateEffects.flatMap((effect) =>
                effect.kind === 'close' ? [effect.privateCompanyId] : []
            )
        )
        const removedRevenueMarkers = state.phaseId === 'IV' ? state.revenueMarkers : []
        if (state.phaseId === 'IV') {
            state.revenueMarkers = []
            removedReservations.push(
                ...releaseStationReservations(state, (reservation) =>
                    AdditionalReservations.some(
                        (additional) =>
                            additional.companyId === reservation.companyId &&
                            additional.locationId === reservation.locationId
                    )
                )
            )
        }
        this.metadata = {
            event,
            removedReservations,
            removedRevenueMarkers,
            closedRailroads,
            companyChanges: changes.changes(state),
            ...(removedSteamboat ? { removedSteamboat } : {}),
            nextState: continuePhaseChange(state, PhaseRules1846)
        }
    }
}
export const advancingPhase1846Handler: MachineStateHandler<
    AdvancePhase1846Action,
    HydratedEighteenFortySixState
> = {
    enter: (context) => context.addSystemAction(AdvancePhase1846),
    validActionsForPlayer: () => [],
    isValidAction: (action, { gameState }) =>
        action instanceof AdvancePhase1846Action &&
        action.source === ActionSource.System &&
        !!gameState.phaseChange &&
        gameState.phaseChange.event.fromPhaseId === gameState.phaseId,
    onAction(action) {
        assert(action.metadata, 'Phase advancement requires its outcome')
        return action.metadata.nextState
    }
}
