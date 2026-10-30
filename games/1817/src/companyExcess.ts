import type {
    HydratedEighteenSeventeenState,
    EighteenSeventeenStateHandler,
    EighteenSeventeenState
} from './state.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import {
    EighteenXXPlayerAction,
    HydratedDiscardMergedTrain,
    type MergedTrainDiscardRules
} from '@tabletop/18xx'
import { stateAfterAcquisition } from './acquisitionRound.js'
import { stateAfterConversion } from './mergerRound.js'
import { discardableTrains, presidentOf, removableStations, trimStations } from './mergerRules.js'
import { activeAcquisitionRound, activeMergerRound } from './state.js'

type State = HydratedGameState & EighteenSeventeenState
type Context = MachineContext<HydratedEighteenSeventeenState>

export function excessCompanyId(state: EighteenSeventeenState): string | undefined {
    return (
        activeMergerRound(state)?.conversion?.companyId ??
        activeAcquisitionRound(state)?.acquisition?.buyerId
    )
}

function excessCompanyFor(state: EighteenSeventeenState, playerId: string): string | undefined {
    const companyId = excessCompanyId(state)
    return companyId && presidentOf(state, companyId) === playerId ? companyId : undefined
}

const CompanyFields = { ...EighteenXXPlayerAction.properties, companyId: Type.String() }

export const RemoveStation = Type.Object(
    {
        ...CompanyFields,
        type: Type.Literal('RemoveStation'),
        stationId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    locationId: Type.String(),
                    destination: Type.Union([Type.Literal('available'), Type.Literal('removed')])
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type RemoveStation = Type.Static<typeof RemoveStation>
const RemoveValidator = Compile(RemoveStation)
export function isRemoveStation(action: GameAction): action is RemoveStation {
    return (
        action instanceof HydratedRemoveStation ||
        (action.type === 'RemoveStation' && RemoveValidator.Check(action))
    )
}
export class HydratedRemoveStation
    extends HydratableAction<typeof RemoveStation>
    implements RemoveStation
{
    declare type: 'RemoveStation'
    declare playerId: string
    declare companyId: string
    declare stationId: string
    declare metadata?: RemoveStation['metadata']
    constructor(data: RemoveStation) {
        super(data instanceof HydratedRemoveStation ? data.dehydrate() : data, RemoveValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            state.machineState === 'ReducingStations' &&
            excessCompanyFor(state, this.playerId) === this.companyId &&
            removableStations(state, this.companyId).some(
                (station) => station.id === this.stationId
            )
        )
    }
    apply(state: State): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            'Only the president may resolve the company’s station conflicts or limit'
        )
        const chosen = removableStations(state, this.companyId).find(
            (station) => station.id === this.stationId
        )
        assertExists(chosen, 'The station is eligible for removal')
        state.stations = state.stations.map((station) =>
            station.id === this.stationId
                ? { id: station.id, companyId: station.companyId, status: 'available' as const }
                : station
        )
        trimStations(state, this.companyId)
        this.metadata = {
            locationId: chosen.position.locationId,
            destination:
                state.stations.find((station) => station.id === this.stationId)?.status ===
                'removed'
                    ? 'removed'
                    : 'available'
        }
    }
}

/** The president of the company over its train limit discards its trains. */
export const MergedTrainDiscards1817: MergedTrainDiscardRules<EighteenSeventeenState> = {
    discards(state, playerId) {
        if (state.machineState !== 'DiscardingMergedTrains') return undefined
        const companyId = excessCompanyFor(state, playerId)
        const trains = companyId ? discardableTrains(state, companyId) : []
        return companyId && trains.length ? { companyId, trains } : undefined
    }
}

/** The president resolves duplicate stations before station and train limits. */
export class CompanyExcessHandler implements EighteenSeventeenStateHandler {
    isValidAction(action: HydratedAction, context: Context): boolean {
        if (action instanceof HydratedRemoveStation) return action.isValidFor(context.gameState)
        return action instanceof HydratedDiscardMergedTrain && action.isValid(context.gameState)
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const companyId = excessCompanyFor(context.gameState, playerId)
        if (!companyId) return []
        return removableStations(context.gameState, companyId).length
            ? ['RemoveStation']
            : discardableTrains(context.gameState, companyId).length
              ? ['DiscardMergedTrain']
              : []
    }
    enter(context: Context): void {
        const companyId = excessCompanyId(context.gameState)
        assertExists(companyId, 'A merged or acquiring company needs station or train choices')
        context.gameState.activePlayerIds = [presidentOf(context.gameState, companyId)]
    }
    onAction(_action: HydratedAction, context: Context): string {
        const state = context.gameState
        return activeMergerRound(state) ? stateAfterConversion(state) : stateAfterAcquisition(state)
    }
}
