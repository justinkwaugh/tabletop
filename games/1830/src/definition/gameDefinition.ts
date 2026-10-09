import { EighteenThirtyNames } from '../names.js'
import { EighteenThirtyEndingRules } from '../endingRules.js'
import { EighteenThirtyAuctionRules, createEighteenThirtyOpening } from '../openingAuction.js'
import { EighteenThirtyTrainFundingRules } from '../trainFundingRules.js'
import { EighteenThirtyTransferRules } from '../transferRules.js'
import { EighteenThirtyPrivatePowerRules } from '../privatePowerRules.js'
import { EighteenThirtyPrivateRules } from '../privateRules.js'
import { EighteenThirtyPhaseRules } from '../phaseRules.js'
import { EighteenThirtyEarningsRules } from '../earningsRules.js'
import { EighteenThirtyRouteRules } from '../routeRules.js'
import { EighteenThirtyPhases, EighteenThirtyTrainRules } from '../trains.js'
import { EighteenThirtyStationRules } from '../stationRules.js'
import { EighteenThirtyTrackRules } from '../trackRules.js'
import { EighteenThirtyOperatingRules } from '../roundRules.js'
import { EighteenThirtyCompanyRules } from '../companyRules.js'
import { EighteenThirtyStockRules } from '../stockRules.js'
import { type GameDefinition } from '@tabletop/common'
import { EighteenThirtyInfo } from './info.js'
import {
    EighteenThirtyStateDefinition,
    EighteenThirtyState,
    type HydratedEighteenThirtyState
} from '../state.js'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'

export const EighteenThirtyTitleRules: EighteenXXTitleRules<
    typeof EighteenThirtyState,
    HydratedEighteenThirtyState
> = {
    state: EighteenThirtyStateDefinition,
    endingRules: EighteenThirtyEndingRules,
    names: EighteenThirtyNames,
    auctionRules: EighteenThirtyAuctionRules,
    trainFundingRules: EighteenThirtyTrainFundingRules,
    transferRules: EighteenThirtyTransferRules,
    privatePowerRules: EighteenThirtyPrivatePowerRules,
    outOfTurnPrivatePowers: true,
    createOpening: createEighteenThirtyOpening,
    stockRules: EighteenThirtyStockRules,
    companyRules: EighteenThirtyCompanyRules,
    operatingRules: EighteenThirtyOperatingRules,
    trackRules: EighteenThirtyTrackRules,
    stationRules: EighteenThirtyStationRules,
    earningsRules: EighteenThirtyEarningsRules,
    routeRules: EighteenThirtyRouteRules,
    privateRules: EighteenThirtyPrivateRules,
    phases: EighteenThirtyPhases,
    phaseRules: EighteenThirtyPhaseRules,
    trainRules: EighteenThirtyTrainRules
}

export const Definition: GameDefinition<EighteenThirtyState, HydratedEighteenThirtyState> = {
    info: EighteenThirtyInfo,
    runtime: createEighteenXXRuntime(EighteenThirtyTitleRules)
}
