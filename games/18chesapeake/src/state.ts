import {
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
    PrivateStationFields,
    PrivateTrackFields,
    RailwayFields,
    StockTurnPurchaseFields,
    RailwayMachineStates,
    validatePendingPar,
    validateRailwayState,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

export const TitleFieldsChesapeake = {
    /** The company whose president's certificate comes with Cornelius Vanderbilt, drawn at setup. */
    corneliusCompanyId: Type.String(),
    /** The Off the Rails expansion is in play, chosen at setup. */
    offTheRails: Type.Optional(Type.Literal(true))
}

export const StateChesapeake = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateTrackFields,
        ...PrivateStationFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        ...TitleFieldsChesapeake
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates]
)
export type StateChesapeake = Type.Static<typeof StateChesapeake>
export type HydratedStateChesapeake = HydratedEighteenXXState<typeof StateChesapeake>
export const StateDefinitionChesapeake = defineEighteenXXState(StateChesapeake, [
    validateRailwayState,
    validateWaterfallAuction,
    validatePendingPar
])

function isStateChesapeake(state: object): state is HydratedStateChesapeake {
    return 'corneliusCompanyId' in state
}

/** A family hook's state, which is always this title's. */
export function requireStateChesapeake(state: object): HydratedStateChesapeake {
    assert(isStateChesapeake(state), 'Family hooks receive the 18Chesapeake state')
    return state
}

/** Whether the game plays the Off the Rails expansion. */
export function offTheRails(state: object): boolean {
    return requireStateChesapeake(state).offTheRails === true
}
