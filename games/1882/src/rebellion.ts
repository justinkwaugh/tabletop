import { ActionSource, assert } from '@tabletop/common'
import {
    SystemActionFirstHandler,
    systemAction,
    type EighteenXXMachineState,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { RebellionLocations } from './map.js'
import type { HydratedState1882, State1882 } from './state.js'
import { tileFace1882 } from './tiles.js'
import { baseTrainCount, extraTrainId } from './trains.js'

const Id = Type.String({ minLength: 1 })

const NorthWestRebellionAction = systemAction('NorthWestRebellion', {
    metadata: Type.Optional(
        Type.Object(
            {
                removed: Type.Array(
                    Type.Object(
                        { locationId: Id, definitionId: Id },
                        { additionalProperties: false }
                    )
                )
            },
            { additionalProperties: false }
        )
    )
})
export const NorthWestRebellion = NorthWestRebellionAction.schema
export type NorthWestRebellion = Type.Static<typeof NorthWestRebellion>
export const isNorthWestRebellion = NorthWestRebellionAction.is

/**
 * Whether the rebellion's train has been bought: the card lies under the first of its kind, or
 * the second where the Saskatchewan Central added one on top (§3, §7.1.2).
 */
export function rebellionDue(state: Pick<State1882, 'rebellion' | 'trainInventory'>): boolean {
    const { definitionId, occurred } = state.rebellion
    if (occurred) return false
    const inDepot = state.trainInventory.trains.filter(
        (train) => train.definitionId === definitionId && train.status === 'depot'
    ).length
    return inDepot < baseTrainCount(definitionId)
}

/**
 * Which train of its kind brings the rebellion: the first, or the second where the Saskatchewan
 * Central put an extra one of that kind on top before any was bought (§3, §7.1.2).
 */
export function rebellionTrainOrdinal(
    state: Pick<State1882, 'rebellion' | 'trainInventory'>
): 1 | 2 {
    const extraId = extraTrainId(state.rebellion.definitionId)
    return state.trainInventory.trains.some((train) => train.id === extraId) ? 2 : 1
}

class HydratedNorthWestRebellion extends NorthWestRebellionAction.Base {
    declare type: 'NorthWestRebellion'
    declare metadata?: NorthWestRebellion['metadata']
    apply(state: HydratedState1882): void {
        assert(
            this.source === ActionSource.System && rebellionDue(state),
            'The rebellion follows the purchase of its train'
        )
        // Yellow tiles go back to the supply; stations stay in their cities (§8).
        const removed = this.rebellionTiles(state)
        const placements = { ...state.tileInventory.placements }
        for (const { locationId } of removed) delete placements[locationId]
        state.tileInventory = { ...state.tileInventory, placements }
        state.rebellion = { ...state.rebellion, occurred: true }
        this.metadata = { removed }
    }

    /** The yellow tiles laid in rebellion hexes, which the rebellion removes (§8). */
    private rebellionTiles(state: State1882) {
        return RebellionLocations.flatMap((locationId) => {
            const placement = state.tileInventory.placements[locationId]
            return placement && tileFace1882(placement.definitionId).color === 'yellow'
                ? [{ locationId, definitionId: placement.definitionId }]
                : []
        })
    }
}

export const RebellionActions1882 = [
    NorthWestRebellionAction.define((action) => new HydratedNorthWestRebellion(action))
]

/** The states a train purchase can lead to, where the rebellion comes first. */
export const RebellionStates: readonly EighteenXXMachineState[] = [
    'BuyingTrains',
    'FundingTrain',
    'AdvancingPhase',
    'RustingTrains',
    'DiscardingTrains',
    'OperatingSet'
]

export function rebels(
    handler: EighteenXXStateHandler<HydratedState1882>
): EighteenXXStateHandler<HydratedState1882> {
    return new SystemActionFirstHandler(handler, NorthWestRebellion, (state) =>
        rebellionDue(state) ? {} : undefined
    )
}
