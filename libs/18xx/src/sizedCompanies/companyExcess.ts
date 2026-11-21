import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { titleAction } from '../actions/titleAction.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import {
    DiscardMergedTrain,
    HydratedDiscardMergedTrain,
    isDiscardMergedTrain,
    type MergedTrainDiscardRules
} from '../trains/discardMergedTrain.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { AcquisitionRounds } from './acquisitionRound.js'
import type { CompanyConversions } from './companyConversions.js'
import type { ConversionRounds } from './conversionRound.js'
import {
    activeAcquisitionRound,
    activeConversionRound,
    type HydratedSizedCompanyState,
    type SizedCompanyState
} from './sizedCompanyState.js'

type State = SizedCompanyState

const RemoveStationAction = titleAction('RemoveStation', {
    companyId: Type.String(),
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
})
export const RemoveStation = RemoveStationAction.schema
export type RemoveStation = Type.Static<typeof RemoveStation>
export const isRemoveStation = RemoveStationAction.is

const RemoveStationMarkerAction = titleAction('RemoveStationMarker', {
    companyId: Type.String(),
    locationId: Type.String(),
    kind: Type.String()
})
/** Giving up a marker counted as a station instead of a station, over the limit (18USA P8). */
export const RemoveStationMarker = RemoveStationMarkerAction.schema
export type RemoveStationMarker = Type.Static<typeof RemoveStationMarker>
export const isRemoveStationMarker = RemoveStationMarkerAction.is

export interface CompanyExcessRules<S extends HydratedSizedCompanyState> {
    conversions: CompanyConversions
    trainRules: TrainRules
    conversionRounds: ConversionRounds<S>
    acquisitionRounds: AcquisitionRounds<S>
}

/**
 * A company merged or acquiring another resolves its duplicate stations, then gives up the
 * stations over its limit and the trains over its train limit, before its round goes on.
 */
export class CompanyExcess<S extends HydratedSizedCompanyState = HydratedSizedCompanyState> {
    constructor(readonly rules: CompanyExcessRules<S>) {}

    /** The company now giving up its excess: the one converting, or the one acquiring. */
    companyId(state: State): string | undefined {
        return (
            activeConversionRound(state)?.conversion?.companyId ??
            activeAcquisitionRound(state)?.acquisition?.buyerId
        )
    }

    private companyFor(state: State, playerId: string): string | undefined {
        const companyId = this.companyId(state)
        return companyId && this.rules.conversions.presidentId(state, companyId) === playerId
            ? companyId
            : undefined
    }

    removableStations(state: State, companyId: string) {
        return this.rules.conversions.rules.stations.removableStations(state, companyId)
    }

    removableMarkers(state: State, companyId: string) {
        return this.rules.conversions.rules.stations.removableMarkers(state, companyId)
    }

    private markerRemovalValid(
        state: State,
        action: { playerId: string; companyId: string; locationId: string; kind: string }
    ) {
        return (
            state.machineState === 'ReducingStations' &&
            this.companyFor(state, action.playerId) === action.companyId &&
            this.removableMarkers(state, action.companyId).some(
                (marker) => marker.locationId === action.locationId && marker.kind === action.kind
            )
        )
    }

    private removeValid(
        state: State,
        action: { playerId: string; companyId: string; stationId: string }
    ) {
        return (
            state.machineState === 'ReducingStations' &&
            this.companyFor(state, action.playerId) === action.companyId &&
            this.removableStations(state, action.companyId).some(
                (station) => station.id === action.stationId
            )
        )
    }

    /** The president of the company over its train limit discards its trains. */
    readonly trainDiscards: MergedTrainDiscardRules<State> = {
        discards: (state, playerId) => {
            if (state.machineState !== 'DiscardingMergedTrains') return undefined
            const companyId = this.companyFor(state, playerId)
            const trains = companyId
                ? this.rules.conversions.discardableTrains(state, companyId)
                : []
            return companyId && trains.length ? { companyId, trains } : undefined
        }
    }

    actions(): ActionDefinition[] {
        return CompanyExcess.actionsOf(this)
    }

    private static actionsOf<S extends HydratedSizedCompanyState>(
        excess: CompanyExcess<S>
    ): ActionDefinition[] {
        const { stations } = excess.rules.conversions.rules
        class HydratedRemoveStation extends RemoveStationAction.Base implements RemoveStation {
            declare type: 'RemoveStation'
            declare playerId: string
            declare companyId: string
            declare stationId: string
            declare metadata?: RemoveStation['metadata']
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User && excess.removeValid(state, this),
                    'Only the president may resolve the company’s station conflicts or limit'
                )
                const chosen = excess
                    .removableStations(state, this.companyId)
                    .find((station) => station.id === this.stationId)
                assertExists(chosen, 'The station is eligible for removal')
                state.stations = state.stations.map((station) =>
                    station.id === this.stationId
                        ? {
                              id: station.id,
                              companyId: station.companyId,
                              status: 'available' as const
                          }
                        : station
                )
                stations.trimStations(state, this.companyId)
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
        class HydratedRemoveStationMarker
            extends RemoveStationMarkerAction.Base
            implements RemoveStationMarker
        {
            declare type: 'RemoveStationMarker'
            declare playerId: string
            declare companyId: string
            declare locationId: string
            declare kind: string
            apply(state: HydratedGameState & State): void {
                assert(
                    this.source === ActionSource.User && excess.markerRemovalValid(state, this),
                    'Only the president may give up a marker over the company’s limit'
                )
                const marker = excess
                    .removableMarkers(state, this.companyId)
                    .find(
                        (marker) =>
                            marker.locationId === this.locationId && marker.kind === this.kind
                    )
                assertExists(marker, 'The marker counts toward the limit')
                stations.rules.limitMarkers?.giveUp(state, this.companyId, marker)
                stations.trimStations(state, this.companyId)
            }
        }
        return [
            RemoveStationAction.define((action) => new HydratedRemoveStation(action)),
            RemoveStationMarkerAction.define((action) => new HydratedRemoveStationMarker(action)),
            defineAction(
                DiscardMergedTrain,
                isDiscardMergedTrain,
                (action) =>
                    new HydratedDiscardMergedTrain(
                        action,
                        excess.rules.trainRules,
                        excess.trainDiscards
                    )
            )
        ]
    }

    /** The handler of both excess states, `ReducingStations` and `DiscardingMergedTrains`. */
    handler(): EighteenXXStateHandler<S> {
        return {
            isValidAction: (action: HydratedAction, context: MachineContext<S>): boolean => {
                if (isRemoveStation(action)) return this.removeValid(context.gameState, action)
                if (isRemoveStationMarker(action))
                    return this.markerRemovalValid(context.gameState, action)
                return (
                    action instanceof HydratedDiscardMergedTrain &&
                    action.isValid(context.gameState)
                )
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] => {
                const state = context.gameState
                const companyId = this.companyFor(state, playerId)
                if (!companyId) return []
                const removals = [
                    ...(this.removableStations(state, companyId).length ? ['RemoveStation'] : []),
                    ...(this.removableMarkers(state, companyId).length
                        ? ['RemoveStationMarker']
                        : [])
                ]
                return removals.length
                    ? removals
                    : this.rules.conversions.discardableTrains(state, companyId).length
                      ? ['DiscardMergedTrain']
                      : []
            },
            enter: (context: MachineContext<S>): void => {
                const state = context.gameState
                const companyId = this.companyId(state)
                assertExists(
                    companyId,
                    'A merged or acquiring company needs station or train choices'
                )
                state.activePlayerIds = [this.rules.conversions.presidentId(state, companyId)]
            },
            onAction: (_action: HydratedAction, context: MachineContext<S>): string => {
                const state = context.gameState
                return activeConversionRound(state)
                    ? this.rules.conversionRounds.stateAfterConversion(state)
                    : this.rules.acquisitionRounds.stateAfterAcquisition(state)
            }
        }
    }

    stateHandlers(): Record<string, EighteenXXStateHandler<S>> {
        const handler = this.handler()
        return { ReducingStations: handler, DiscardingMergedTrains: handler }
    }
}
