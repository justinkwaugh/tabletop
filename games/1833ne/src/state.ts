import * as Type from 'typebox'
import {
    AuctionFields,
    CashCrisisFields,
    CorporateFinanceFields,
    PrivatePowerFields,
    PrivateTrackFields,
    RailwayFields,
    composeEighteenXXState,
    defineEighteenXXState,
    validateRailwayState,
    validateWaterfallAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { FerryFields } from './ferries.js'
import { PrivateFields1833NE } from './privates.js'
import { TrackFields1833NE } from './track.js'
import { TakeoverFields1833NE, TakingOverState } from './takeoverState.js'

export const State1833NE = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        // The C&StL's second tile, laid once its first is.
        ...PrivateTrackFields,
        ...AuctionFields,
        ...CorporateFinanceFields,
        bankruptPlayerIds: CashCrisisFields.bankruptPlayerIds,
        ...FerryFields,
        ...TrackFields1833NE,
        ...PrivateFields1833NE,
        ...TakeoverFields1833NE
    },
    [
        'WaterfallAuction',
        'AuctionBidding',
        'StockRound',
        'StartingOperatingSet',
        'OperatingSet',
        'LayingTrack',
        'RunningTrains',
        'DistributingEarnings',
        'ClosingOperatingCorporation',
        'BuyingTrains',
        'FundingTrain',
        'GameOver',
        'AdvancingPhase',
        'DiscardingTrains',
        'RustingTrains',
        TakingOverState
    ]
)
export type State1833NE = Type.Static<typeof State1833NE>
export type HydratedState1833NE = HydratedEighteenXXState<typeof State1833NE>
export type StateHandler1833NE = EighteenXXStateHandler<HydratedState1833NE>
export const StateDefinition1833NE = defineEighteenXXState(State1833NE, [
    validateRailwayState,
    validateWaterfallAuction
])
