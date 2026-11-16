import {
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
    PrivateTrackFields,
    RailwayFields,
    RailwayMachineStates,
    StockTurnPurchaseFields,
    validatePendingPar,
    validateRailwayState,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

/**
 * The North-West Rebellion: the train whose first purchase reveals it, drawn at setup (§3), and
 * whether it has happened (§8).
 */
export const Rebellion1882 = Type.Object(
    { definitionId: Type.String(), occurred: Type.Optional(Type.Literal(true)) },
    { additionalProperties: false }
)
export type Rebellion1882 = Type.Static<typeof Rebellion1882>

export const TitleFields1882 = {
    rebellion: Rebellion1882,
    /** The company whose 10% share comes with the Trestle Bridge, drawn at setup (§3). */
    trestleShareCompanyId: Type.String()
}

export const State1882 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateTrackFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        ...TitleFields1882
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates]
)
export type State1882 = Type.Static<typeof State1882>
export type HydratedState1882 = HydratedEighteenXXState<typeof State1882>
export const StateDefinition1882 = defineEighteenXXState(State1882, [
    validateRailwayState,
    validateWaterfallAuction,
    validatePendingPar
])
