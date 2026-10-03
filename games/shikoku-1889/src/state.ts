import {
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PrivatePowerFields,
    PrivateRequestFields,
    PrivateTrackFields,
    PrivateWindowFields,
    RailwayFields,
    RailwayMachineStates,
    validateRailwayState,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

export const Shikoku1889State = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateTrackFields,
        ...PrivateWindowFields,
        ...PrivateRequestFields,

        ...AuctionFields
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates]
)
export type Shikoku1889State = Type.Static<typeof Shikoku1889State>
export type HydratedShikoku1889State = HydratedEighteenXXState<typeof Shikoku1889State>
export const Shikoku1889StateDefinition = defineEighteenXXState(Shikoku1889State, [
    validateRailwayState,
    validateWaterfallAuction
])
